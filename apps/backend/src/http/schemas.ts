import type { Request } from 'express';
import { z } from 'zod';
import { badRequest } from './errors.js';

/** Fecha de calendario "YYYY-MM-DD"; se guarda en columnas DATE. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), 'Fecha inexistente');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal como #2dd4a7');

export const uuidSchema = z.string().uuid('Identificador inválido');

/** Prioridad manual: 1 es backlog y 5 es urgente. */
export const prioritySchema = z.number().int().min(1).max(5);

/**
 * Lee un identificador de la ruta validando que sea un UUID. Descarta basura
 * antes de que llegue a la base de datos, con un 400 en vez de un fallo opaco.
 */
export function idParam(req: Request, name = 'id'): string {
  const value = req.params[name];
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw badRequest(`El parámetro "${name}" no es un identificador válido`);
  return parsed.data;
}
