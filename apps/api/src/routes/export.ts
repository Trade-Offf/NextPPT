import type { FastifyRequest, FastifyReply } from 'fastify';
import { exportFilename } from '../lib/protocol.js';
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
import type { FastifyBaseLogger } from 'fastify';

// ─── Storage dirs ────────────────────────────────────────────────────────────
// Downloads are produced artifacts served to the browser. Jobs hold the
// per-export working files while the background task runs.

const DOWNLOAD_DIR = path.join(os.tmpdir(), 'hds-downloads');
const WORK_DIR = path.join(os.tmpdir(), 'hds-jobs');
const DOWNLOAD_TTL_MS = 30 * 60 * 1000; // 30 min
const JOB_TTL_MS = 30 * 60 * 1000; // keep job state pollable for 30 min

await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
await fs.mkdir(WORK_DIR, { recursive: true });

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
  for (const [key, job] of jobs) {
    if (job.expiresAt < now) jobs.delete(key);
  }
}, 60_000);

// ─── Job store ───────────────────────────────────────────────────────────────
// Exports run as background jobs decoupled from any single HTTP connection, so
// a dropped client (network change, tab reload) never loses the work. Clients
// reconnect to the events stream by jobId and pick up the latest state.

type JobStatus = 'queued' | 'running' | 'done' | 'error';

interface ExportJob {
  id: string;
  status: JobStatus;
  phase: string;
  current: number;
  total: number;
  url?: string;
  filename?: string;
  error?: string;
  expiresAt: number;
}

const jobs = new Map<string, ExportJob>();

// ─── Concurrency gate ──────────────────────────────────────────────────────────
// Serialize heavy renders so multiple concurrent 4K Chromium instances don't
// thrash the box (the prod failure mode behind ERR_NETWORK_CHANGED on retry).

const MAX_CONCURRENT = Math.max(1, parseInt(process.env['EXPORT_CONCURRENCY'] ?? '1', 10) || 1);
let activeCount = 0;
const slotQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => slotQueue.push(resolve));
}

function releaseSlot(): void {
  activeCount -= 1;
  const next = slotQueue.shift();
  if (next) {
    activeCount += 1;
    next();
  }
}

// ─── Render settings ───────────────────────────────────────────────────────────

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
// Slides are authored at a fixed 1280x720 canvas, so output resolution is
// controlled purely by the device scale factor (supersampling), not viewport.
const SCALE_BY_RESOLUTION: Record<string, number> = {
  '1280x720@2x': 2, // 2560x1440
  '1920x1080@2x': 3, // 3840x2160 (~4K)
  '3840x2160@2x': 4, // 5120x2880
};

const EXPORT_IMAGE_TYPE: 'png' | 'jpeg' =
  process.env['EXPORT_IMAGE_FORMAT']?.toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
const EXPORT_IMAGE_QUALITY = parseInt(process.env['EXPORT_IMAGE_QUALITY'] ?? '90', 10);

const allowedOrigins = (
  process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ─── Background processing ─────────────────────────────────────────────────────

async function processExportJob(
  job: ExportJob,
  opts: ExportOptions,
  workDir: string,
  htmlFilename: string,
  log: FastifyBaseLogger,
): Promise<void> {
  await acquireSlot();
  job.status = 'running';
  try {
    const deviceScaleFactor = SCALE_BY_RESOLUTION[opts.resolution] ?? 2;
    const deckHtmlPath = path.join(workDir, htmlFilename);

    let outPath: string;
    let fileName: string;

    if (opts.mode === 'doc') {
      job.phase = 'render';
      const docFormat = opts.format === 'png' ? 'png' : 'pdf';
      const result = await renderDocument(deckHtmlPath, {
        format: docFormat,
        viewportWidth: VIEWPORT_WIDTH,
        deviceScaleFactor,
        tmpDir: workDir,
        onProgress: (current, total) => {
          job.current = current;
          job.total = total;
          job.phase = 'render';
        },
      });
      const title = opts.meta.title ?? 'document';
      const safe = title.replace(/[^\w\u4e00-\u9fa5\- ]/g, '').trim() || 'document';
      outPath = result.filePath;
      fileName = `${safe}.${result.ext}`;
    } else {
      const screenshots = await screenshotSlides(deckHtmlPath, {
        viewportWidth: VIEWPORT_WIDTH,
        viewportHeight: VIEWPORT_HEIGHT,
        deviceScaleFactor,
        pageRange: opts.pageRange,
        imageType: EXPORT_IMAGE_TYPE,
        imageQuality: EXPORT_IMAGE_QUALITY,
        onProgress: (current, total) => {
          job.current = current;
          job.total = total;
          job.phase = 'screenshot';
        },
      });

      job.phase = 'assemble';
      job.current = screenshots.length;
      job.total = screenshots.length;

      const title = opts.meta.title ?? 'deck';
      const ordinals = screenshots.map((s) => s.ordinal);
      fileName = exportFilename(title, opts.format, ordinals, screenshots.length);

      if (opts.format === 'pptx') {
        outPath = await buildPptx(screenshots, {
          title,
          viewportWidth: VIEWPORT_WIDTH,
          viewportHeight: VIEWPORT_HEIGHT,
          tmpDir: workDir,
        });
      } else {
        outPath = await buildPdf(screenshots, { title, tmpDir: workDir });
      }
    }

    // Move the artifact into the persistent download dir, then mint a token.
    const token = crypto.randomUUID();
    const cachedPath = path.join(DOWNLOAD_DIR, `${token}-${fileName}`);
    await fs.copyFile(outPath, cachedPath);
    downloadCache.set(token, {
      filePath: cachedPath,
      fileName,
      expiresAt: Date.now() + DOWNLOAD_TTL_MS,
    });

    job.url = `/v1/download/${token}`;
    job.filename = fileName;
    job.phase = 'done';
    job.status = 'done';
  } catch (err) {
    log.error(err, 'export job failed');
    job.status = 'error';
    job.error = String(err);
  } finally {
    job.expiresAt = Date.now() + JOB_TTL_MS;
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    releaseSlot();
  }
}

// ─── POST /v1/export ───────────────────────────────────────────────────────────
// Consumes the multipart upload, starts a background job, and returns a jobId
// immediately. The heavy work continues regardless of the client connection.

export async function exportHandler(req: FastifyRequest, reply: FastifyReply) {
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

  let meta: ExportOptions['meta'] = {};
  try {
    meta = JSON.parse(fields['meta'] ?? '{}') as ExportOptions['meta'];
  } catch {
    meta = {};
  }

  const opts: ExportOptions = {
    format: (fields['format'] ?? 'pptx') as ExportOptions['format'],
    resolution: (fields['resolution'] ?? '1280x720@2x') as ExportOptions['resolution'],
    watermark: (fields['watermark'] ?? 'off') as ExportOptions['watermark'],
    pageRange: fields['pageRange'] ?? 'all',
    meta,
    mode: (fields['mode'] ?? 'deck') as ExportOptions['mode'],
  };

  const htmlFile = fileBuffers.find((f) => f.filename.endsWith('.html'));
  if (!htmlFile) {
    return reply.code(400).send({
      error: `No HTML file received (got ${fileBuffers.length} file(s))`,
    });
  }

  // Persist uploaded files to a job-scoped dir that outlives this request.
  const jobId = crypto.randomUUID();
  const workDir = path.join(WORK_DIR, jobId);
  await fs.mkdir(workDir, { recursive: true });
  for (const { filename, buffer } of fileBuffers) {
    const dest = path.join(workDir, filename);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
  }

  const job: ExportJob = {
    id: jobId,
    status: 'queued',
    phase: 'queued',
    current: 0,
    total: 0,
    expiresAt: Date.now() + JOB_TTL_MS,
  };
  jobs.set(jobId, job);

  req.log.info({ jobId, fileCount: fileBuffers.length, fields }, 'export: job queued');

  // Fire-and-forget: the background task drives the job to done/error.
  void processExportJob(job, opts, workDir, htmlFile.filename, req.log);

  return reply.code(202).send({ jobId });
}

// ─── GET /v1/export/:jobId/events ──────────────────────────────────────────────
// Reconnectable SSE progress stream. On connect it pushes the current snapshot,
// then updates until the job reaches a terminal state. Reconnecting after the
// job finished immediately replays the final done/error event.

export async function exportEventsHandler(
  req: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
) {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  // Writing to reply.raw bypasses Fastify's reply lifecycle (and @fastify/cors),
  // so echo the allowed Origin onto the raw response ourselves.
  const reqOrigin = req.headers.origin;
  if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
    reply.raw.setHeader('Access-Control-Allow-Origin', reqOrigin);
    reply.raw.setHeader('Vary', 'Origin');
  }
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders?.();

  const sse = (event: string, data: unknown) =>
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (!job) {
    // Named 'failed' (not 'error') so it doesn't collide with EventSource's
    // built-in connection-error event on the client.
    sse('failed', { code: 'JOB_NOT_FOUND', message: 'Export job not found or expired' });
    reply.raw.end();
    return;
  }

  // Emit current state. Returns true when terminal (caller should stop).
  const emit = (): boolean => {
    if (job.status === 'done') {
      sse('done', { url: job.url, filename: job.filename });
      return true;
    }
    if (job.status === 'error') {
      sse('failed', { code: 'EXPORT_FAILED', message: job.error ?? 'Export failed' });
      return true;
    }
    sse('progress', { current: job.current, total: job.total, phase: job.phase });
    return false;
  };

  if (emit()) {
    reply.raw.end();
    return;
  }

  const poll = setInterval(() => {
    try {
      if (emit()) {
        clearInterval(poll);
        clearInterval(heartbeat);
        reply.raw.end();
      }
    } catch {
      clearInterval(poll);
      clearInterval(heartbeat);
    }
  }, 700);

  // Keep the connection warm during long silent phases (assemble/build).
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  req.raw.on('close', () => {
    clearInterval(poll);
    clearInterval(heartbeat);
  });
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
