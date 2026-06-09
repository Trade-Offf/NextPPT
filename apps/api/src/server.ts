import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { exportHandler, exportEventsHandler, downloadHandler } from './routes/export.js';

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

app.get('/healthz', async () => ({ ok: true }));

const port = parseInt(process.env['PORT'] ?? '3000', 10);
const host = process.env['HOST'] ?? '0.0.0.0';
await app.listen({ port, host });

// Graceful shutdown: drain in-flight requests/SSE on stop signals. With Docker
// `init: true` (tini) forwarding SIGTERM to PID 1, this lets `docker compose
// stop/up` close cleanly instead of being force-killed.
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');
    app
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error(err, 'error during shutdown');
        process.exit(1);
      });
  });
}
