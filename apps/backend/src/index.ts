import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { prisma } from './db.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { authRouter } from './auth/auth.routes.js';
import { requireAuth } from './auth/auth.service.js';
import { clientsRouter } from './clients/clients.routes.js';
import { projectsRouter } from './projects/projects.routes.js';
import { tasksRouter } from './tasks/tasks.routes.js';
import { objectivesRouter } from './objectives/objectives.routes.js';
import { aiRouter } from './ai/ai.routes.js';
import { notificationsRouter } from './notifications/notifications.routes.js';
import { integrationsRouter } from './integrations/integrations.routes.js';
import { startScheduler } from './scheduler.js';

const app = express();

/**
 * Sin CORS_ORIGIN se acepta cualquier origen, que es lo cómodo en local. Al
 * desplegar hay que fijarlo a la dirección del frontend: la API entrega datos
 * de clientes y el token viaja en cada petición.
 */
const allowedOrigins = env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);

if (allowedOrigins?.length) {
  app.use(cors({ origin: allowedOrigins }));
  console.log(`CORS restringido a: ${allowedOrigins.join(', ')}`);
} else {
  app.use(cors());
  if (env.NODE_ENV === 'production') {
    console.warn('CORS_ORIGIN sin definir: la API acepta peticiones de cualquier origen.');
  }
}

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

const api = express.Router();
api.use('/auth', authRouter);

// Todo lo que sigue exige sesion: se aplica una vez, no ruta por ruta.
api.use(requireAuth);
api.use('/clients', clientsRouter);
api.use('/projects', projectsRouter);
api.use('/tasks', tasksRouter);
api.use('/objectives', objectivesRouter);
api.use('/ai', aiRouter);
api.use('/notifications', notificationsRouter);
api.use('/integrations', integrationsRouter);

app.use('/api/v1', api);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}/api/v1`);
  startScheduler();
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
