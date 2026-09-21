import { daysUntil } from '../prioritization/engine.js';
import { days as daysWord, plural, tasks as tasksWord } from '../utils/plural.js';

/** Tope diario por persona. Pasado esto, el aviso deja de informar y molesta. */
export const MAX_NOTIFICATIONS_PER_DAY = 3;

/** Se avisa con dos dias de margen: suficiente para reaccionar, no tan pronto que se olvide. */
export const DEADLINE_WARNING_DAYS = 2;

export interface NotifiableTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: Date | null;
  aiPriorityScore: number | null;
  projectName?: string;
}

/**
 * Una fecha cercana sola no justifica interrumpir: tambien tiene que ser algo
 * que importe, sea porque la persona lo marco asi o porque el puntaje lo pone
 * arriba. Lo menor vence en silencio y aparece en el resumen.
 */
export function shouldAlertDeadline(task: NotifiableTask, now: Date): boolean {
  if (task.status === 'done' || !task.dueDate) return false;

  const days = daysUntil(task.dueDate, now);
  if (days > DEADLINE_WARNING_DAYS) return false;

  return task.priority >= 3 || (task.aiPriorityScore ?? 0) >= 7;
}

export interface DeadlineAlert {
  task: NotifiableTask;
  title: string;
  message: string;
}

export function composeDeadlineAlert(task: NotifiableTask, now: Date): DeadlineAlert {
  const days = task.dueDate ? daysUntil(task.dueDate, now) : 0;

  const when =
    days < 0
      ? `venció hace ${daysWord(Math.abs(days))}`
      : days === 0
        ? 'vence hoy'
        : days === 1
          ? 'vence mañana'
          : `vence en ${daysWord(days)}`;

  const where = task.projectName ? ` · ${task.projectName}` : '';

  return {
    task,
    title: days < 0 ? `Se pasó: ${task.title}` : `${task.title} ${when}`,
    message: `${task.title}${where} — ${when}.`,
  };
}

export interface DigestInput {
  recommended: NotifiableTask | null;
  recommendedReason: string;
  overdue: NotifiableTask[];
  dueToday: NotifiableTask[];
  blockedCount: number;
}

export interface Digest {
  title: string;
  message: string;
  /** Falso cuando no hay nada que contar: ese dia no se manda nada. */
  worthSending: boolean;
}

/** Resumen de la mañana: por donde empezar y que esta en rojo. */
export function composeDailyDigest(input: DigestInput): Digest {
  const lines: string[] = [];

  if (input.recommended) {
    lines.push(`Empieza por: ${input.recommended.title}. ${input.recommendedReason}`);
  }

  if (input.overdue.length > 0) {
    const names = input.overdue.slice(0, 3).map((t) => t.title).join(', ');
    const rest = input.overdue.length > 3 ? ` y ${input.overdue.length - 3} más` : '';
    lines.push(`Vencidas (${input.overdue.length}): ${names}${rest}.`);
  }

  if (input.dueToday.length > 0) {
    const names = input.dueToday.slice(0, 3).map((t) => t.title).join(', ');
    const rest = input.dueToday.length > 3 ? ` y ${input.dueToday.length - 3} más` : '';
    lines.push(`Para hoy (${input.dueToday.length}): ${names}${rest}.`);
  }

  if (input.blockedCount > 0) {
    lines.push(`${tasksWord(input.blockedCount)} ${input.blockedCount === 1 ? "espera" : "esperan"} que termines otra.`);
  }

  const total = input.overdue.length + input.dueToday.length;
  const title =
    total === 0
      ? input.recommended
        ? 'Tu día está despejado'
        : 'Nada pendiente hoy'
      : `${plural(total, 'cosa pide', 'cosas piden')} atención hoy`;

  return {
    title,
    message: lines.length > 0 ? lines.join('\n') : 'No hay tareas abiertas con fecha.',
    worthSending: lines.length > 0,
  };
}
