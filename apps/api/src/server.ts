import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { exportHandler, exportEventsHandler, downloadHandler } from './routes/export.js';
import { assetRoutes } from './routes/assets.js';

const app = Fastify({ logger: true });

const corsOrigins = (
  process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-HDS-Trace-Id'],
});
await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } }); // 200 MB

app.post('/v1/export', exportHandler);
app.get('/v1/export/:jobId/events', exportEventsHandler);
app.get('/v1/download/:token', downloadHandler);
await app.register(assetRoutes);

app.get('/healthz', async () => ({ ok: true }));

const port = parseInt(process.env['PORT'] ?? '3000', 10);
const host = process.env['HOST'] ?? '0.0.0.0';
await app.listen({ port, host });
