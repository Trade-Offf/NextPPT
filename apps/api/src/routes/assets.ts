/**
 * /v1/asset-base/* — serves local files from the path stored in the
 * X-HDS-Asset-Root header (set per-session by the web app).
 *
 * Security: only GET, only within the registered root, no directory traversal.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { lookup } from '../lib/mime.js';

// Per-connection asset root (stored in-process; fine for local-only use)
let assetRoot = '';

export function setAssetRoot(root: string) {
  assetRoot = root;
}

export async function assetRoutes(app: FastifyInstance) {
  // POST /v1/asset-root  — called by web app when a folder is opened
  app.post<{ Body: { root: string } }>('/v1/asset-root', {
    schema: { body: { type: 'object', properties: { root: { type: 'string' } }, required: ['root'] } },
  }, async (req, reply) => {
    setAssetRoot(req.body.root);
    return reply.send({ ok: true, root: assetRoot });
  });

  // GET /v1/asset-base/*  — proxies local files
  app.get('/v1/asset-base/*', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!assetRoot) return reply.code(503).send({ error: 'Asset root not set. Call POST /v1/asset-root first.' });

    const url = (req as FastifyRequest & { params: { '*': string } }).params['*'] ?? '';
    const relative = decodeURIComponent(url).replace(/^\/+/, '');

    // Prevent directory traversal
    const abs = path.resolve(assetRoot, relative);
    if (!abs.startsWith(path.resolve(assetRoot))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      await fs.access(abs);
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }

    const mime = lookup(abs);
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'public, max-age=60');
    reply.header('Access-Control-Allow-Origin', '*');
    return reply.send(createReadStream(abs));
  });
}
