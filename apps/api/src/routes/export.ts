import type { FastifyRequest, FastifyReply } from 'fastify';
import { parsePageRange, exportFilename } from '@hds/protocol';
import type { ExportOptions } from '@hds/protocol';
import { screenshotSlides } from '../services/screenshotter.js';
import { buildPptx } from '../services/pptxBuilder.js';
import { buildPdf } from '../services/pdfBuilder.js';
import { withTmpDir } from '../services/tmp.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// In-memory download cache (files auto-deleted after TTL)
const downloadCache = new Map<string, { filePath: string; fileName: string; expiresAt: number }>();
const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

// Cleanup stale downloads every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of downloadCache) {
    if (entry.expiresAt < now) {
      fs.unlink(entry.filePath).catch(() => {});
      downloadCache.delete(key);
    }
  }
}, 60_000);

export async function exportHandler(req: FastifyRequest, reply: FastifyReply) {
  // Parse multipart
  const parts = req.parts();
  const fields: Record<string, string> = {};
  const fileBuffers: { fieldname: string; filename: string; buffer: Buffer }[] = [];

  for await (const part of parts) {
    if (part.type === 'file') {
      const chunks: Uint8Array[] = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuffers.push({ fieldname: part.fieldname, filename: part.filename ?? 'file', buffer: Buffer.concat(chunks) });
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

  // Parse resolution
  const [res, scale] = opts.resolution.split('@');
  const [viewportWidth, viewportHeight] = (res ?? '1280x720').split('x').map(Number) as [number, number];
  const deviceScaleFactor = parseInt(scale?.replace('x', '') ?? '2', 10);

  // Set up SSE response
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders?.();

  const sse = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await withTmpDir(async (tmpDir) => {
      // Write uploaded files to tmp dir
      for (const { filename, buffer } of fileBuffers) {
        const dest = path.join(tmpDir, filename);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, buffer);
      }

      sse('progress', { current: 0, total: 0, phase: 'unpack' });

      // Take screenshots
      const htmlFiles = fileBuffers.filter((f) => f.filename.endsWith('.html'));
      if (!htmlFiles.length) throw new Error('No HTML file provided');

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

      // Cache for download
      const token = crypto.randomUUID();
      const cachedPath = path.join(tmpDir, `${token}-${fileName}`);
      await fs.copyFile(outPath, cachedPath);
      downloadCache.set(token, { filePath: cachedPath, fileName, expiresAt: Date.now() + DOWNLOAD_TTL_MS });

      sse('done', { url: `/v1/download/${token}`, filename: fileName });
    });
  } catch (err) {
    sse('error', { code: 'EXPORT_FAILED', message: String(err) });
  }

  reply.raw.end();
}

export async function downloadHandler(req: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) {
  const { token } = req.params;
  const entry = downloadCache.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return reply.code(404).send({ error: 'Download expired or not found' });
  }
  const buffer = await fs.readFile(entry.filePath);
  reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(entry.fileName)}"`);
  reply.header('Content-Type', entry.fileName.endsWith('.pptx')
    ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : 'application/pdf');
  return reply.send(buffer);
}
