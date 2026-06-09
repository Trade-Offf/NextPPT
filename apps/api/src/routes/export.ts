import type { FastifyRequest, FastifyReply } from 'fastify';
import { parsePageRange, exportFilename } from '../lib/protocol.js';
import type { ExportOptions } from '../lib/protocol.js';
import { screenshotSlides } from '../services/screenshotter.js';
import { buildPptx } from '../services/pptxBuilder.js';
import { buildPdf } from '../services/pdfBuilder.js';
import { renderDocument } from '../services/documentRenderer.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

// ─── Persistent download cache ───────────────────────────────────────────────
// Files are stored in a dedicated dir outside any withTmpDir scope.

const DOWNLOAD_DIR = path.join(os.tmpdir(), 'hds-downloads');
const DOWNLOAD_TTL_MS = 10 * 60 * 1000; // 10 min

await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

interface CacheEntry { filePath: string; fileName: string; expiresAt: number }
const downloadCache = new Map<string, CacheEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of downloadCache) {
    if (entry.expiresAt < now) {
      fs.unlink(entry.filePath).catch(() => {});
      downloadCache.delete(key);
    }
  }
}, 60_000);

// ─── Export handler ──────────────────────────────────────────────────────────

export async function exportHandler(req: FastifyRequest, reply: FastifyReply) {
  // 1. Consume all multipart parts BEFORE writing SSE headers
  const parts = req.parts();
  const fields: Record<string, string> = {};
  const fileBuffers: { filename: string; buffer: Buffer }[] = [];

  for await (const part of parts) {
    if (part.type === 'file') {
      const chunks: Uint8Array[] = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuffers.push({
        filename: part.filename ?? 'file',
        buffer: Buffer.concat(chunks),
      });
    } else {
      fields[part.fieldname] = (part as { value: string }).value;
    }
  }

  const opts: ExportOptions = {
    format: (fields['format'] ?? 'pptx') as ExportOptions['format'],
    resolution: (fields['resolution'] ?? '1280x720@2x') as ExportOptions['resolution'],
    watermark: (fields['watermark'] ?? 'off') as ExportOptions['watermark'],
    pageRange: fields['pageRange'] ?? 'all',
    meta: JSON.parse(fields['meta'] ?? '{}') as ExportOptions['meta'],
    mode: (fields['mode'] ?? 'deck') as ExportOptions['mode'],
  };

  // Slides are authored at a fixed 1280x720 canvas, so output resolution is
  // controlled purely by the device scale factor (supersampling), not viewport.
  const SCALE_BY_RESOLUTION: Record<string, number> = {
    '1280x720@2x': 2, // 2560x1440
    '1920x1080@2x': 3, // 3840x2160 (~4K)
    '3840x2160@2x': 4, // 5120x2880
  };
  const viewportWidth = 1280;
  const viewportHeight = 720;
  const deviceScaleFactor = SCALE_BY_RESOLUTION[opts.resolution] ?? 2;

  // Optional payload shrink: set EXPORT_IMAGE_FORMAT=jpeg to capture slides as
  // JPEG instead of PNG. At 2x+ supersampling this is visually near-identical
  // for typical decks but cuts file size ~3-5x, easing bandwidth/failure window.
  const exportImageType: 'png' | 'jpeg' =
    process.env['EXPORT_IMAGE_FORMAT']?.toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
  const exportImageQuality = parseInt(process.env['EXPORT_IMAGE_QUALITY'] ?? '90', 10);

  // 2. Now set up SSE
  // @fastify/cors sets CORS headers on the Fastify reply, but this handler writes
  // directly to reply.raw (bypassing Fastify's reply lifecycle), so the CORS
  // headers are lost. Echo the allowed Origin onto the raw response ourselves.
  const reqOrigin = req.headers.origin;
  const allowedOrigins = (
    process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:4173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
    reply.raw.setHeader('Access-Control-Allow-Origin', reqOrigin);
    reply.raw.setHeader('Vary', 'Origin');
  }

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders?.();

  const sse = (event: string, data: unknown) =>
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // 3. Work inside a scoped temp dir
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hds-work-'));
  try {
    // Write uploaded files
    for (const { filename, buffer } of fileBuffers) {
      const dest = path.join(tmpDir, filename);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buffer);
    }

    req.log.info({ fileCount: fileBuffers.length, fields }, 'export: files received');
    sse('progress', { current: 0, total: 0, phase: 'unpack' });

    const htmlFiles = fileBuffers.filter((f) => f.filename.endsWith('.html'));
    if (!htmlFiles.length) throw new Error(`No HTML file received (got ${fileBuffers.length} file(s))`);

    const deckHtmlPath = path.join(tmpDir, htmlFiles[0]!.filename);

    let outPath: string;
    let fileName: string;

    if (opts.mode === 'doc') {
      // Free-edit: render the whole document with smart pagination.
      sse('progress', { current: 0, total: 1, phase: 'render' });
      const docFormat = opts.format === 'png' ? 'png' : 'pdf';
      const result = await renderDocument(deckHtmlPath, {
        format: docFormat,
        viewportWidth,
        deviceScaleFactor,
        tmpDir,
        onProgress: (current, total) => sse('progress', { current, total, phase: 'render' }),
      });
      sse('progress', { current: 1, total: 1, phase: 'assemble' });
      const title = opts.meta.title ?? 'document';
      const safe = title.replace(/[^\w\u4e00-\u9fa5\- ]/g, '').trim() || 'document';
      outPath = result.filePath;
      fileName = `${safe}.${result.ext}`;
    } else {
      const screenshots = await screenshotSlides(deckHtmlPath, {
        viewportWidth,
        viewportHeight,
        deviceScaleFactor,
        pageRange: opts.pageRange,
        imageType: exportImageType,
        imageQuality: exportImageQuality,
        onProgress: (current, total) => sse('progress', { current, total, phase: 'screenshot' }),
      });

      sse('progress', { current: screenshots.length, total: screenshots.length, phase: 'assemble' });

      const title = opts.meta.title ?? 'deck';
      const ordinals = screenshots.map((s) => s.ordinal);
      fileName = exportFilename(title, opts.format, ordinals, screenshots.length);

      if (opts.format === 'pptx') {
        outPath = await buildPptx(screenshots, { title, viewportWidth, viewportHeight, tmpDir });
      } else {
        outPath = await buildPdf(screenshots, { title, tmpDir });
      }
    }

    // Copy output to persistent download dir BEFORE cleaning up tmpDir
    const token = crypto.randomUUID();
    const cachedPath = path.join(DOWNLOAD_DIR, `${token}-${fileName}`);
    await fs.copyFile(outPath, cachedPath);
    downloadCache.set(token, { filePath: cachedPath, fileName, expiresAt: Date.now() + DOWNLOAD_TTL_MS });

    sse('done', { url: `/v1/download/${token}`, filename: fileName });
  } catch (err) {
    req.log.error(err, 'export failed');
    sse('error', { code: 'EXPORT_FAILED', message: String(err) });
  } finally {
    // Clean up working tmp dir
    await fs.rm(tmpDir, { recursive: true, force: true });
    reply.raw.end();
  }
}

// ─── Download handler ────────────────────────────────────────────────────────

function contentTypeForName(fileName: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pptx'))
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
}

export async function downloadHandler(
  req: FastifyRequest<{ Params: { token: string } }>,
  reply: FastifyReply,
) {
  const { token } = req.params;
  const entry = downloadCache.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return reply.code(404).send({ error: 'Download link expired or not found' });
  }

  // Stat the file so we can advertise an exact Content-Length and honor Range
  // requests. If it has been swept by TTL cleanup, treat as gone.
  const stat = await fs.stat(entry.filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    downloadCache.delete(token);
    return reply.code(404).send({ error: 'Download file no longer available' });
  }
  const total = stat.size;

  reply.header('Content-Type', contentTypeForName(entry.fileName));
  reply.header(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(entry.fileName)}`,
  );
  // Advertise byte-range support so browsers/download managers can resume.
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'no-store');

  // ── Range request → 206 Partial Content (enables resume without restart) ──
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const startRaw = match[1] ?? '';
      const endRaw = match[2] ?? '';
      let start: number;
      let end: number;
      if (startRaw === '' && endRaw !== '') {
        // Suffix range: "bytes=-N" → last N bytes.
        const suffix = parseInt(endRaw, 10);
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = startRaw === '' ? 0 : parseInt(startRaw, 10);
        end = endRaw === '' ? total - 1 : parseInt(endRaw, 10);
      }

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        start >= total ||
        start < 0
      ) {
        reply.header('Content-Range', `bytes */${total}`);
        return reply.code(416).send();
      }

      end = Math.min(end, total - 1);
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${total}`);
      reply.header('Content-Length', String(end - start + 1));
      return reply.send(createReadStream(entry.filePath, { start, end }));
    }
    // Malformed Range → fall through to a normal full 200 response.
  }

  reply.header('Content-Length', String(total));
  return reply.send(createReadStream(entry.filePath));
}
