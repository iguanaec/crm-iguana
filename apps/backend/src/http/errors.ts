import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../env.js';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, message, details);
export const unauthorized = (message = 'No autenticado') => new AppError(401, message);
export const forbidden = (message = 'Sin permiso sobre este recurso') => new AppError(403, message);
export const notFound = (message = 'Recurso no encontrado') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);

/** Express 4 no captura rechazos de handlers async: este envoltorio los reenvia a next(). */
export function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    details: env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada' });
}
