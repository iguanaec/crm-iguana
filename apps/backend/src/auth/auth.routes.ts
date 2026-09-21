import { Router } from 'express';
import { z } from 'zod';
import type { User } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, conflict, notFound, unauthorized } from '../http/errors.js';
import { currentUserId, hashPassword, requireAuth, signToken, verifyPassword } from './auth.service.js';

const registerSchema = z.object({
  email: z.string().email('Correo inválido').toLowerCase().trim(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  timezone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Correo inválido').toLowerCase().trim(),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const preferencesSchema = z.object({
  name: z.string().min(2).trim().optional(),
  timezone: z.string().min(1).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  notifyDailyDigest: z.boolean().optional(),
  notifyDeadlines: z.boolean().optional(),
  notifyPriority: z.boolean().optional(),
});

const publicUser = {
  id: true,
  email: true,
  name: true,
  timezone: true,
  digestHour: true,
  notifyDailyDigest: true,
  notifyDeadlines: true,
  notifyPriority: true,
  createdAt: true,
} as const;

type PublicUserRow = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  digestHour: number;
  createdAt: Date;
};

function toUser(row: PublicUserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    digestHour: row.digestHour,
    createdAt: row.createdAt.toISOString(),
  };
}

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncRoute(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) throw conflict('Ya existe una cuenta con ese correo');

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        ...(body.timezone ? { timezone: body.timezone } : {}),
      },
      select: publicUser,
    });

    res.status(201).json({ token: signToken(user.id), user: toUser(user) });
  }),
);

authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Mismo mensaje en ambos casos para no revelar que correos estan registrados.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized('Correo o contraseña incorrectos');
    }

    res.json({ token: signToken(user.id), user: toUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId(req) },
      select: publicUser,
    });
    if (!user) throw notFound('Usuario no encontrado');

    res.json({
      user: toUser(user),
      preferences: {
        digestHour: user.digestHour,
        notifyDailyDigest: user.notifyDailyDigest,
        notifyDeadlines: user.notifyDeadlines,
        notifyPriority: user.notifyPriority,
      },
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = preferencesSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: currentUserId(req) },
      data: body,
      select: publicUser,
    });

    res.json({
      user: toUser(user),
      preferences: {
        digestHour: user.digestHour,
        notifyDailyDigest: user.notifyDailyDigest,
        notifyDeadlines: user.notifyDeadlines,
        notifyPriority: user.notifyPriority,
      },
    });
  }),
);
