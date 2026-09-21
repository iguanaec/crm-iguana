import type { ManualPriority } from '@crm/types';

/**
 * Las fechas de tarea son de calendario ("2026-09-21"), no instantes. Pasarlas
 * por `new Date(iso)` las lee como medianoche UTC y en una zona negativa se
 * muestran un dia antes, asi que se arma la fecha local por componentes.
 */
export function parseCalendarDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

function startOfLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysFromToday(iso: string): number {
  const target = parseCalendarDate(iso);
  const diff = target.getTime() - startOfLocalToday().getTime();
  return Math.round(diff / 86_400_000);
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Fecha en palabras, relativa cuando eso dice mas: "vence hoy", "hace 3 días". */
export function describeDueDate(iso: string | null): { text: string; tone: DueTone } {
  if (!iso) return { text: 'sin fecha', tone: 'none' };

  const days = daysFromToday(iso);
  if (days < -1) return { text: `hace ${Math.abs(days)} días`, tone: 'overdue' };
  if (days === -1) return { text: 'ayer', tone: 'overdue' };
  if (days === 0) return { text: 'hoy', tone: 'today' };
  if (days === 1) return { text: 'mañana', tone: 'soon' };
  if (days <= 6) return { text: WEEKDAYS[parseCalendarDate(iso).getDay()]!, tone: 'soon' };

  const date = parseCalendarDate(iso);
  return { text: `${date.getDate()} ${MONTHS[date.getMonth()]}`, tone: 'later' };
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-coral',
  today: 'text-amber',
  soon: 'text-ink',
  later: 'text-ink-mute',
  none: 'text-ink-mute',
};

export const PRIORITY_LABEL: Record<ManualPriority, string> = {
  5: 'Urgente',
  4: 'Alta',
  3: 'Normal',
  2: 'Baja',
  1: 'Backlog',
};

/** Barra de prioridad: el color sube de frio a calido con el nivel. */
export const PRIORITY_COLOR: Record<ManualPriority, string> = {
  5: 'bg-coral',
  4: 'bg-amber',
  3: 'bg-azure',
  2: 'bg-ink-mute',
  1: 'bg-surface-4',
};

export function scoreTone(score: number | null): string {
  if (score === null) return 'text-ink-mute';
  if (score >= 7.5) return 'text-coral';
  if (score >= 5.5) return 'text-amber';
  if (score >= 3.5) return 'text-jade';
  return 'text-ink-mute';
}

export function formatScore(score: number | null): string {
  return score === null ? '—' : score.toFixed(1);
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function formatAmount(value: number, unit: string | null): string {
  const formatted =
    unit === 'COP' || value >= 10_000
      ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)
      : String(value);

  if (unit === 'porcentaje') return `${formatted}%`;
  if (unit === 'COP') return `$${formatted}`;
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Hues para distinguir proyectos, en el orden validado para superficie oscura
 * (separacion suficiente entre pares vecinos incluso con daltonismo). El color
 * nunca viaja solo: siempre acompaña al nombre del proyecto.
 */
export const PROJECT_COLORS = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

export const STATUS_LABEL: Record<string, string> = {
  todo: 'Por hacer',
  in_progress: 'En curso',
  review: 'Revisión',
  done: 'Listo',
};
