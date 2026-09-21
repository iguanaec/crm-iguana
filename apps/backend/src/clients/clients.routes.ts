import { Router } from 'express';
import { z } from 'zod';
import { CLIENT_STATUSES } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { toClient } from '../http/serialize.js';
import { idParam } from '../http/schemas.js';

const createSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  email: z.string().email('Correo inválido').trim().nullish(),
  phone: z.string().trim().max(40).nullish(),
  company: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(5000).nullish(),
  status: z.enum(CLIENT_STATUSES).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
});

const updateSchema = createSchema.partial();

export const clientsRouter = Router();

clientsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = z
      .object({
        search: z.string().trim().optional(),
        status: z.enum(CLIENT_STATUSES).optional(),
      })
      .parse(req.query);

    const clients = await prisma.client.findMany({
      where: {
        userId: currentUserId(req),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { company: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });

    res.json({ items: clients.map(toClient) });
  }),
);

clientsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const client = await prisma.client.findFirst({
      where: { id: idParam(req), userId: currentUserId(req) },
      include: {
        projects: {
          select: { id: true, name: true, status: true, color: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!client) throw notFound('Cliente no encontrado');

    res.json({ client: toClient(client), projects: client.projects });
  }),
);

clientsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = createSchema.parse(req.body);

    const client = await prisma.client.create({
      data: { ...body, userId: currentUserId(req) },
    });

    res.status(201).json({ client: toClient(client) });
  }),
);

clientsRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const userId = currentUserId(req);

    const existing = await prisma.client.findFirst({
      where: { id: idParam(req), userId },
      select: { id: true },
    });
    if (!existing) throw notFound('Cliente no encontrado');

    const client = await prisma.client.update({ where: { id: existing.id }, data: body });
    res.json({ client: toClient(client) });
  }),
);

clientsRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = currentUserId(req);

    const existing = await prisma.client.findFirst({
      where: { id: idParam(req), userId },
      select: { id: true },
    });
    if (!existing) throw notFound('Cliente no encontrado');

    // Los proyectos sobreviven con clientId en null (onDelete: SetNull).
    await prisma.client.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
