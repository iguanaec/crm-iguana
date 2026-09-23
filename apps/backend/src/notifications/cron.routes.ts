import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../env.js';
import { asyncRoute, notFound, unauthorized } from '../http/errors.js';
import { runDailyDigest, runDeadlineScan } from './notifications.service.js';

/**
 * Los planes gratuitos suspenden el servicio por inactividad, y con él los
 * temporizadores internos: el resumen de la mañana nunca llegaría. Esta ruta
 * deja que un cron externo despierte al servidor y dispare las revisiones.
 *
 * No usa sesión de usuario porque quien llama es una máquina. Se protege con un
 * secreto propio, y sin ese secreto configurado la ruta sencillamente no existe.
 */
export const cronRouter = Router();

function matchesSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual exige igual longitud; comparar antes ya revela solo eso.
  return a.length === b.length && timingSafeEqual(a, b);
}

cronRouter.post(
  '/run',
  asyncRoute(async (req, res) => {
    const expected = env.CRON_SECRET;
    if (!expected) throw notFound('Ruta no encontrada');

    const header = req.headers.authorization;
    const provided = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!provided || !matchesSecret(provided, expected)) {
      throw unauthorized('Secreto de cron inválido');
    }

    const digests = await runDailyDigest();
    const deadlines = await runDeadlineScan();

    res.json({ digests, deadlines, ranAt: new Date().toISOString() });
  }),
);
