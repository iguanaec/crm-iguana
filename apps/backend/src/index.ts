import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { prisma } from './db.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { authRouter } from './auth/auth.routes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

const api = express.Router();
api.use('/auth', authRouter);

app.use('/api/v1', api);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}/api/v1`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
