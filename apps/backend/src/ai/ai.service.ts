import {
  days as daysWord,
  prioritizeTasks,
  scoreToManualPriority,
  tasks as tasksWord,
  type ScorableTask,
} from '@crm/assistant';
import type {
  Bottleneck,
  DashboardInsights,
  ManualPriority,
  NextTaskSuggestion,
  PriorityChange,
  PrioritizeResponse,
  TaskWithRelations,
} from '@crm/types';
import { prisma } from '../db.js';
import { toTask } from '../http/serialize.js';

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  assignedTo: { select: { id: true, name: true } },
} as const;

type TaskRow = Parameters<typeof toTask>[0] & {
  project: { id: string; name: string; color: string };
  assignedTo: { id: string; name: string } | null;
};

function present(row: TaskRow): TaskWithRelations {
  return { ...toTask(row), project: row.project, assignedTo: row.assignedTo };
}

function toScorable(row: TaskRow): ScorableTask {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    assignedToId: row.assignedToId,
    dependsOn: row.dependsOn,
    objectiveId: row.objectiveId,
  };
}

function startOfToday(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Une motivos en una frase legible: "a", "a y b", "a, b y c". */
function joinReasons(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/**
 * Una discrepancia de un solo nivel entre el score y la prioridad manual casi
 * siempre es matiz, no error: avisar de eso entrena a ignorar al asistente.
 */
const MIN_PRIORITY_GAP = 2;

/**
 * Recalcula el score de las tareas abiertas y guarda el resultado. Devuelve solo
 * las discrepancias grandes frente a la prioridad que fijo la persona: el resto
 * no necesita su atencion.
 */
export async function recalculatePriorities(
  userId: string,
  projectId?: string,
): Promise<PrioritizeResponse> {
  const [tasks, objectives] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { userId, ...(projectId ? { id: projectId } : { status: 'active' }) },
        status: { not: 'done' },
      },
      include: taskInclude,
    }),
    prisma.objective.findMany({ where: { userId }, select: { id: true, isCritical: true } }),
  ]);

  const results = prioritizeTasks(tasks.map(toScorable), objectives);
  const previousById = new Map(tasks.map((t) => [t.id, t.aiPriorityScore]));
  const currentById = new Map(tasks.map((t) => [t.id, t.priority as ManualPriority]));
  const titleById = new Map(tasks.map((t) => [t.id, t.title]));

  const calculatedAt = new Date();

  await prisma.$transaction(
    results.map((result) =>
      prisma.task.update({
        where: { id: result.taskId },
        data: {
          aiPriorityScore: result.score,
          // Prisma pide un objeto JSON indexable; los factores son un tipo cerrado.
          aiPriorityFactors: { ...result.factors },
          aiPriorityUpdatedAt: calculatedAt,
        },
      }),
    ),
  );

  const changes: PriorityChange[] = results.flatMap((result) => {
    const suggestedPriority = scoreToManualPriority(result.score);
    const currentPriority = currentById.get(result.taskId) ?? 3;
    if (Math.abs(suggestedPriority - currentPriority) < MIN_PRIORITY_GAP) return [];

    return [
      {
        ...result,
        taskTitle: titleById.get(result.taskId) ?? '',
        previousScore: previousById.get(result.taskId) ?? null,
        suggestedPriority,
        currentPriority,
      },
    ];
  });

  return {
    tasksEvaluated: results.length,
    changes: changes.sort((a, b) => b.score - a.score),
    calculatedAt: calculatedAt.toISOString(),
  };
}

/**
 * La siguiente tarea es la de mayor score entre las que se pueden empezar ya:
 * una tarea con dependencias sin terminar no se recomienda, aunque urja.
 */
export async function suggestNextTask(userId: string): Promise<NextTaskSuggestion> {
  const tasks = await prisma.task.findMany({
    where: { project: { userId, status: 'active' }, status: { not: 'done' } },
    include: taskInclude,
    orderBy: [{ aiPriorityScore: 'desc' }, { dueDate: 'asc' }],
  });

  if (tasks.length === 0) {
    return { task: null, reason: 'No hay tareas abiertas. Buen momento para planear.', confidence: 1, alternatives: [] };
  }

  const openIds = new Set(tasks.map((t) => t.id));
  const ready = tasks.filter((task) => !task.dependsOn.some((id) => openIds.has(id)));

  if (ready.length === 0) {
    return {
      task: null,
      reason: 'Todas las tareas abiertas esperan a otra. Revisa las que bloquean el avance.',
      confidence: 0.8,
      alternatives: [],
    };
  }

  const [best, ...rest] = ready;
  const blockedCount = tasks.filter((t) => t.dependsOn.includes(best!.id)).length;

  const reasons: string[] = [];
  if (best!.dueDate) {
    const days = Math.round((best!.dueDate.getTime() - startOfToday().getTime()) / 86_400_000);
    if (days < 0) reasons.push(`está vencida hace ${daysWord(Math.abs(days))}`);
    else if (days === 0) reasons.push('vence hoy');
    else if (days === 1) reasons.push('vence mañana');
    else reasons.push(`vence en ${daysWord(days)}`);
  }
  if (blockedCount > 0) reasons.push(`desbloquea ${tasksWord(blockedCount)}`);
  if (best!.status === 'in_progress') reasons.push('ya está empezada');

  const reason =
    reasons.length > 0
      ? `Es lo más rentable ahora: ${joinReasons(reasons)}.`
      : 'Es la tarea con mayor puntaje que puedes empezar sin esperar a nada.';

  return {
    task: present(best!),
    reason,
    confidence: Math.min(0.95, 0.6 + (best!.aiPriorityScore ?? 0) / 25),
    alternatives: rest.slice(0, 2).map((task) => ({
      task: present(task),
      reason: task.dueDate ? 'También tiene fecha próxima.' : 'Sigue en puntaje.',
    })),
  };
}

export async function findBottlenecks(userId: string): Promise<Bottleneck[]> {
  const open = await prisma.task.findMany({
    where: { project: { userId, status: 'active' }, status: { not: 'done' } },
    include: taskInclude,
  });

  const blockedTitlesByBlocker = new Map<string, string[]>();
  for (const task of open) {
    for (const blockerId of task.dependsOn) {
      const list = blockedTitlesByBlocker.get(blockerId) ?? [];
      list.push(task.title);
      blockedTitlesByBlocker.set(blockerId, list);
    }
  }

  return open
    .flatMap((task) => {
      const blockedTaskTitles = blockedTitlesByBlocker.get(task.id) ?? [];
      // Con una sola tarea detras es una secuencia normal, no un cuello de botella.
      if (blockedTaskTitles.length < 2) return [];
      return [{ task: present(task), blockingCount: blockedTaskTitles.length, blockedTaskTitles }];
    })
    .sort((a, b) => b.blockingCount - a.blockingCount);
}

export async function buildInsights(userId: string): Promise<DashboardInsights> {
  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // El recalculo va primero y solo: lo demas lee los puntajes que acaba de
  // guardar. En paralelo leerian los valores anteriores (o null la primera vez).
  const prioritization = await recalculatePriorities(userId);

  const [nextTask, bottlenecks, openTasks, objectives] = await Promise.all([
    suggestNextTask(userId),
    findBottlenecks(userId),
    prisma.task.findMany({
      where: { project: { userId, status: 'active' }, status: { not: 'done' } },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }],
    }),
    prisma.objective.findMany({
      where: { userId },
      include: { tasks: { select: { status: true } } },
      orderBy: [{ isCritical: 'desc' }, { endDate: 'asc' }],
    }),
  ]);

  const dueToday = openTasks.filter(
    (task) => task.dueDate && task.dueDate.getTime() === today.getTime(),
  );
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today);

  // Carga por dia de la semana entrante: sirve para ver donde se acumula el trabajo.
  const weekLoad: DashboardInsights['weekLoad'] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + offset);
    const ofDay = openTasks.filter(
      (task) => task.dueDate && task.dueDate.getTime() === day.getTime(),
    );

    weekLoad.push({
      date: day.toISOString().slice(0, 10),
      taskCount: ofDay.length,
      estimatedHours: ofDay.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0),
    });
  }

  return {
    nextTask,
    dueToday: dueToday.map(present),
    overdue: overdue.map(present),
    bottlenecks: bottlenecks.slice(0, 3),
    prioritySuggestions: prioritization.changes.slice(0, 5),
    weekLoad,
    objectiveProgress: objectives.map((objective) => {
      const linkedTaskCount = objective.tasks.length;
      const completedTaskCount = objective.tasks.filter((t) => t.status === 'done').length;

      const progressPercentage =
        objective.goalType === 'completion' && linkedTaskCount > 0
          ? Math.round((completedTaskCount / linkedTaskCount) * 100)
          : objective.targetValue && objective.targetValue > 0
            ? Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100))
            : 0;

      return {
        id: objective.id,
        projectId: objective.projectId,
        title: objective.title,
        description: objective.description,
        goalType: objective.goalType,
        targetValue: objective.targetValue,
        currentValue: objective.currentValue,
        unit: objective.unit,
        startDate: objective.startDate ? objective.startDate.toISOString().slice(0, 10) : null,
        endDate: objective.endDate ? objective.endDate.toISOString().slice(0, 10) : null,
        isCritical: objective.isCritical,
        createdAt: objective.createdAt.toISOString(),
        updatedAt: objective.updatedAt.toISOString(),
        progressPercentage,
        linkedTaskCount,
        completedTaskCount,
      };
    }),
  };
}
