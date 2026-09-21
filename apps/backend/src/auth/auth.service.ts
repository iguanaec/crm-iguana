import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';
import { prisma } from '../db.js';
import { unauthorized } from '../http/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Lo llena `requireAuth`; las rutas protegidas pueden darlo por seguro. */
    userId?: string;
  }
}

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Exige un JWT valido cuyo usuario siga existiendo. La consulta extra evita que
 * un token siga sirviendo despues de borrar la cuenta.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) throw unauthorized('Falta el token de acceso');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw unauthorized('Token inválido o expirado');
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) throw unauthorized('Token inválido');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw unauthorized('La cuenta ya no existe');

    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

/** Id del usuario autenticado. Solo se llama dentro de rutas tras `requireAuth`. */
export function currentUserId(req: Request): string {
  const userId = req.userId;
  if (!userId) throw unauthorized();
  return userId;
}
