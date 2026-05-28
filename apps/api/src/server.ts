import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { exportHandler } from './routes/export.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: ['http://localhost:5173', 'http://localhost:4173'] });
await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } }); // 200 MB

app.post('/v1/export', exportHandler);

app.get('/healthz', async () => ({ ok: true }));

const port = parseInt(process.env['PORT'] ?? '3000', 10);
await app.listen({ port, host: '127.0.0.1' });
