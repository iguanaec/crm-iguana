import type { ManualPriority, PriorityFactors, PriorityResult } from '@crm/types';

export const FACTOR_WEIGHTS = {
  urgency: 0.4,
  dependencies: 0.3,
  impact: 0.2,
  workload: 0.1,
} as const;

/** Tarea reducida a lo que el motor necesita. Mantiene el paquete libre de Prisma. */
export interface ScorableTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: Date | null;
  assignedToId: string | null;
  dependsOn: string[];
  objectiveId: string | null;
}

export interface ScorableObjective {
  id: string;
  isCritical: boolean;
}

export interface TaskContext {
  /** Cuantas tareas sin terminar declaran a esta como bloqueante. */
  blockedCount: number;
  /** Tareas activas del responsable, para no saturar a una sola persona. */
  assigneeActiveCount: number;
  objective: ScorableObjective | null;
}

const MS_PER_DAY = 86_400_000;

/** Dias calendario entre hoy y la fecha limite. Negativo si ya vencio. */
export function daysUntil(dueDate: Date, now: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due - today) / MS_PER_DAY);
}

/** Proximidad a la fecha limite. Una tarea vencida siempre satura el factor. */
export function calculateUrgency(dueDate: Date | null, now: Date): number {
  if (!dueDate) return 0.2;

  const days = daysUntil(dueDate, now);
  if (days <= 0) return 1;
  if (days <= 1) return 1;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.5;
  if (days <= 14) return 0.35;
  return 0.25;
}

/** Cada tarea bloqueada suma 0.1; desbloquear trabajo ajeno pesa mas que avanzar solo. */
export function calculateDependencies(blockedCount: number): number {
  return Math.min(1, blockedCount * 0.1);
}

export function calculateImpact(objective: ScorableObjective | null): number {
  if (!objective) return 0;
  return objective.isCritical ? 1 : 0.5;
}

/** Carga del responsable normalizada: 0 = libre, 1 = saturado. */
export function calculateWorkload(assigneeActiveCount: number): number {
  if (assigneeActiveCount > 10) return 1;
  if (assigneeActiveCount > 5) return 0.5;
  return 0;
}

export function combineFactors(factors: PriorityFactors): number {
  const raw =
    factors.urgency * FACTOR_WEIGHTS.urgency +
    factors.dependencies * FACTOR_WEIGHTS.dependencies +
    factors.impact * FACTOR_WEIGHTS.impact +
    (1 - factors.workload) * FACTOR_WEIGHTS.workload;

  return Math.round(raw * 1000) / 100;
}

/** Traduce el score 0-10 a la escala manual 1-5 para poder sugerir un cambio. */
export function scoreToManualPriority(score: number): ManualPriority {
  if (score >= 8) return 5;
  if (score >= 6.5) return 4;
  if (score >= 4.5) return 3;
  if (score >= 3) return 2;
  return 1;
}

function explain(task: ScorableTask, factors: PriorityFactors, context: TaskContext, now: Date): string {
  const parts: string[] = [];

  if (task.dueDate) {
    const days = daysUntil(task.dueDate, now);
    if (days < 0) parts.push(`vencida hace ${Math.abs(days)} día(s)`);
    else if (days === 0) parts.push('vence hoy');
    else if (days === 1) parts.push('vence mañana');
    else if (days <= 7) parts.push(`vence en ${days} días`);
  }

  if (context.blockedCount > 0) {
    parts.push(`bloquea ${context.blockedCount} tarea(s)`);
  }

  if (context.objective) {
    parts.push(context.objective.isCritical ? 'ligada a un objetivo crítico' : 'aporta a un objetivo');
  }

  if (factors.workload >= 0.5) {
    parts.push('el responsable ya está cargado');
  }

  if (parts.length === 0) return 'Sin fecha límite ni dependencias: puede esperar.';
  return parts.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.';
}

export function scoreTask(task: ScorableTask, context: TaskContext, now: Date): PriorityResult {
  const factors: PriorityFactors = {
    urgency: calculateUrgency(task.dueDate, now),
    dependencies: calculateDependencies(context.blockedCount),
    impact: calculateImpact(context.objective),
    workload: calculateWorkload(context.assigneeActiveCount),
  };

  return {
    taskId: task.id,
    score: combineFactors(factors),
    factors,
    reason: explain(task, factors, context, now),
  };
}

const OPEN_STATUSES = new Set(['todo', 'in_progress', 'review']);

export function isOpen(task: Pick<ScorableTask, 'status'>): boolean {
  return OPEN_STATUSES.has(task.status);
}

/**
 * Puntua cada tarea abierta del conjunto. Deriva por si misma quien bloquea a
 * quien y la carga de cada responsable, de modo que quien llama solo aporta datos.
 */
export function prioritizeTasks(
  tasks: ScorableTask[],
  objectives: ScorableObjective[],
  now: Date = new Date(),
): PriorityResult[] {
  const openTasks = tasks.filter(isOpen);

  const blockedCounts = new Map<string, number>();
  for (const task of openTasks) {
    for (const blockerId of task.dependsOn) {
      blockedCounts.set(blockerId, (blockedCounts.get(blockerId) ?? 0) + 1);
    }
  }

  const activeCounts = new Map<string, number>();
  for (const task of openTasks) {
    if (task.assignedToId) {
      activeCounts.set(task.assignedToId, (activeCounts.get(task.assignedToId) ?? 0) + 1);
    }
  }

  const objectivesById = new Map(objectives.map((o) => [o.id, o]));

  return openTasks
    .map((task) =>
      scoreTask(
        task,
        {
          blockedCount: blockedCounts.get(task.id) ?? 0,
          assigneeActiveCount: task.assignedToId ? (activeCounts.get(task.assignedToId) ?? 0) : 0,
          objective: task.objectiveId ? (objectivesById.get(task.objectiveId) ?? null) : null,
        },
        now,
      ),
    )
    .sort((a, b) => b.score - a.score);
}
