import type { FastifyRequest, FastifyReply } from 'fastify';
import { parsePageRange, exportFilename } from '../lib/protocol.js';
import type { ExportOptions } from '../lib/protocol.js';
import { screenshotSlides } from '../services/screenshotter.js';
import { buildPptx } from '../services/pptxBuilder.js';
import { buildPdf } from '../services/pdfBuilder.js';
import path from 'node:path';
import fs from 'node:fs/promises';
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

  // 2. Now set up SSE
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

    const screenshots = await screenshotSlides(deckHtmlPath, {
      viewportWidth,
      viewportHeight,
      deviceScaleFactor,
      pageRange: opts.pageRange,
      onProgress: (current, total) => sse('progress', { current, total, phase: 'screenshot' }),
    });

    sse('progress', { current: screenshots.length, total: screenshots.length, phase: 'assemble' });

    const title = opts.meta.title ?? 'deck';
    const ordinals = screenshots.map((s) => s.ordinal);
    const fileName = exportFilename(title, opts.format, ordinals, screenshots.length);

    let outPath: string;
    if (opts.format === 'pptx') {
      outPath = await buildPptx(screenshots, { title, viewportWidth, viewportHeight, tmpDir });
    } else {
      outPath = await buildPdf(screenshots, { title, tmpDir });
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

export async function downloadHandler(
  req: FastifyRequest<{ Params: { token: string } }>,
  reply: FastifyReply,
) {
  const { token } = req.params;
  const entry = downloadCache.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return reply.code(404).send({ error: 'Download link expired or not found' });
  }
  const buffer = await fs.readFile(entry.filePath);
  const isPptx = entry.fileName.endsWith('.pptx');
  reply.header(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(entry.fileName)}`,
  );
  reply.header(
    'Content-Type',
    isPptx
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf',
  );
  return reply.send(buffer);
}
