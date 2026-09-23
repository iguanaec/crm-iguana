import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
// Un solo .env en la raiz del monorepo es la fuente de verdad.
config({ path: resolve(here, '../../../.env') });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Conexión directa para las migraciones; con Supabase difiere de la anterior. */
  DIRECT_URL: z.string().min(1, 'Falta DIRECT_URL (en local, la misma que DATABASE_URL)'),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DEFAULT_TIMEZONE: z.string().default('America/Bogota'),
  /** Origen del frontend, separado por comas. Vacío deja pasar cualquiera (solo local). */
  CORS_ORIGIN: z.string().optional(),
  /** Habilita la ruta de cron externo. Sin esto, la ruta no existe. */
  CRON_SECRET: z.string().min(16, 'CRON_SECRET debe tener al menos 16 caracteres').optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuración inválida en .env:\n${issues}\n\nCopia .env.example a .env y complétalo.`);
  process.exit(1);
}

export const env = parsed.data;
