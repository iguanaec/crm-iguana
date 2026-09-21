import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncRoute, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { toNotification } from '../http/serialize.js';
import { idParam, uuidSchema } from '../http/schemas.js';
import { runDailyDigest, runDeadlineScan } from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = z
      .object({ unreadOnly: z.enum(['true', 'false']).optional() })
      .parse(req.query);

    const userId = currentUserId(req);

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, ...(query.unreadOnly === 'true' ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.json({ items: items.map(toNotification), unreadCount });
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncRoute(async (req, res) => {
    const userId = currentUserId(req);
    const id = idParam(req);

    const existing = await prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw notFound('Notificación no encontrada');

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ notification: toNotification(notification) });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncRoute(async (req, res) => {
    const body = z.object({ ids: z.array(uuidSchema).max(200).optional() }).parse(req.body ?? {});

    const { count } = await prisma.notification.updateMany({
      where: {
        userId: currentUserId(req),
        isRead: false,
        ...(body.ids?.length ? { id: { in: body.ids } } : {}),
      },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ updated: count });
  }),
);

/**
 * Dispara las revisiones que normalmente corren solas. Sirve para probar los
 * avisos sin esperar a la hora programada.
 */
notificationsRouter.post(
  '/run-checks',
  asyncRoute(async (_req, res) => {
    const [digests, deadlines] = [await runDailyDigest(), await runDeadlineScan()];
    res.json({ digests, deadlines });
  }),
);
