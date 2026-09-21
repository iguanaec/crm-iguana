import { Router } from 'express';
import { z } from 'zod';
import { TASK_STATUSES } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, badRequest, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import {
  assertObjectiveAccess,
  assertPipelineAccess,
  assertProjectAccess,
  assertTaskAccess,
} from '../http/ownership.js';
import { parseDateOnly, toHistoryEntry, toTask } from '../http/serialize.js';
import { dateOnlySchema, idParam, prioritySchema, uuidSchema } from '../http/schemas.js';
import { wouldCreateCycle } from './dependencies.js';
import { recalculatePriorities } from '../ai/ai.service.js';

/**
 * Los puntajes de un proyecto dependen unos de otros: una tarea nueva cambia la
 * cuenta de bloqueos y la carga del responsable. Recalcular el proyecto al
 * escribir evita que el tablero muestre un guion donde debería ir un número.
 */
async function rescoreProject(userId: string, projectId: string): Promise<void> {
  try {
    await recalculatePriorities(userId, projectId);
  } catch (error) {
    // El dato ya se guardó; un fallo aquí solo deja el puntaje sin refrescar.
    console.warn('No se pudo recalcular el proyecto:', error);
  }
}

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  assignedTo: { select: { id: true, name: true } },
} as const;

const createSchema = z.object({
  projectId: uuidSchema,
  pipelineId: uuidSchema,
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').trim(),
  description: z.string().trim().max(10_000).nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: prioritySchema.optional(),
  startDate: dateOnlySchema.nullish(),
  dueDate: dateOnlySchema.nullish(),
  estimatedHours: z.number().positive().max(1000).nullish(),
  assignedToId: uuidSchema.nullish(),
  parentTaskId: uuidSchema.nullish(),
  dependsOn: z.array(uuidSchema).max(50).optional(),
  objectiveId: uuidSchema.nullish(),
  labels: z.array(z.string().trim().min(1)).max(20).optional(),
  generatedFromPrompt: z.string().trim().max(2000).nullish(),
});

const updateSchema = createSchema.omit({ projectId: true }).partial().extend({
  pipelineId: uuidSchema.optional(),
  actualHours: z.number().min(0).max(1000).nullish(),
});

/** Solo estos campos dejan rastro: el historial debe leerse, no inundar. */
const TRACKED_FIELDS = ['status', 'priority', 'dueDate', 'assignedToId'] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

function describeChange(field: TrackedField): string {
  switch (field) {
    case 'status':
      return 'status_changed';
    case 'priority':
      return 'priority_changed';
    case 'dueDate':
      return 'due_date_changed';
    case 'assignedToId':
      return 'assigned';
  }
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export const tasksRouter = Router();

tasksRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = z
      .object({
        projectId: uuidSchema.optional(),
        pipelineId: uuidSchema.optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assignedToId: uuidSchema.optional(),
        dueBefore: dateOnlySchema.optional(),
        open: z.enum(['true', 'false']).optional(),
        sort: z.enum(['score', 'due', 'priority', 'position']).default('position'),
      })
      .parse(req.query);

    const userId = currentUserId(req);
    if (query.projectId) await assertProjectAccess(query.projectId, userId);

    const orderBy =
      query.sort === 'score'
        ? [{ aiPriorityScore: 'desc' as const }, { dueDate: 'asc' as const }]
        : query.sort === 'due'
          ? [{ dueDate: 'asc' as const }]
          : query.sort === 'priority'
            ? [{ priority: 'desc' as const }, { dueDate: 'asc' as const }]
            : [{ position: 'asc' as const }];

    const tasks = await prisma.task.findMany({
      where: {
        project: { userId },
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
        ...(query.dueBefore ? { dueDate: { lte: parseDateOnly(query.dueBefore)! } } : {}),
        ...(query.open === 'true' ? { status: { not: 'done' } } : {}),
      },
      include: taskInclude,
      orderBy,
    });

    res.json({
      items: tasks.map((task) => ({
        ...toTask(task),
        project: task.project,
        assignedTo: task.assignedTo,
      })),
    });
  }),
);

tasksRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = currentUserId(req);

    const task = await prisma.task.findFirst({
      where: { id: idParam(req), project: { userId } },
      include: {
        ...taskInclude,
        subtasks: { orderBy: { position: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!task) throw notFound('Tarea no encontrada');

    // Quienes esperan por esta tarea: es el factor de dependencias hecho visible.
    const blocking = await prisma.task.findMany({
      where: { projectId: task.projectId, dependsOn: { has: task.id }, status: { not: 'done' } },
      select: { id: true, title: true, status: true },
    });

    const blockedBy =
      task.dependsOn.length > 0
        ? await prisma.task.findMany({
            where: { id: { in: task.dependsOn } },
            select: { id: true, title: true, status: true },
          })
        : [];

    res.json({
      task: { ...toTask(task), project: task.project, assignedTo: task.assignedTo },
      subtasks: task.subtasks.map(toTask),
      history: task.history.map(toHistoryEntry),
      blocking,
      blockedBy,
    });
  }),
);

tasksRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = createSchema.parse(req.body);
    const userId = currentUserId(req);

    await assertProjectAccess(body.projectId, userId);

    const pipeline = await assertPipelineAccess(body.pipelineId, userId);
    if (pipeline.projectId !== body.projectId) {
      throw badRequest('El pipeline pertenece a otro proyecto');
    }

    if (body.objectiveId) await assertObjectiveAccess(body.objectiveId, userId);
    if (body.parentTaskId) {
      const parent = await assertTaskAccess(body.parentTaskId, userId);
      if (parent.projectId !== body.projectId) {
        throw badRequest('La tarea padre pertenece a otro proyecto');
      }
    }

    if (body.dependsOn?.length) {
      const found = await prisma.task.findMany({
        where: { id: { in: body.dependsOn }, projectId: body.projectId },
        select: { id: true },
      });
      if (found.length !== body.dependsOn.length) {
        throw badRequest('Alguna dependencia no existe en este proyecto');
      }
    }

    const position = await prisma.task.count({ where: { pipelineId: body.pipelineId } });

    const task = await prisma.task.create({
      data: {
        projectId: body.projectId,
        pipelineId: body.pipelineId,
        createdById: userId,
        title: body.title,
        description: body.description ?? null,
        ...(body.status ? { status: body.status } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        startDate: parseDateOnly(body.startDate),
        dueDate: parseDateOnly(body.dueDate),
        estimatedHours: body.estimatedHours ?? null,
        assignedToId: body.assignedToId ?? null,
        parentTaskId: body.parentTaskId ?? null,
        dependsOn: body.dependsOn ?? [],
        objectiveId: body.objectiveId ?? null,
        labels: body.labels ?? [],
        generatedFromPrompt: body.generatedFromPrompt ?? null,
        position,
        history: { create: { changedById: userId, changeType: 'created' } },
      },
      include: taskInclude,
    });

    await rescoreProject(userId, body.projectId);

    const scored = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: taskInclude,
    });

    res.status(201).json({
      task: { ...toTask(scored), project: scored.project, assignedTo: scored.assignedTo },
    });
  }),
);

tasksRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const userId = currentUserId(req);

    const before = await prisma.task.findFirst({
      where: { id: idParam(req), project: { userId } },
    });
    if (!before) throw notFound('Tarea no encontrada');

    if (body.pipelineId) {
      const pipeline = await assertPipelineAccess(body.pipelineId, userId);
      if (pipeline.projectId !== before.projectId) {
        throw badRequest('El pipeline pertenece a otro proyecto');
      }
    }

    if (body.objectiveId) await assertObjectiveAccess(body.objectiveId, userId);

    if (body.dependsOn) {
      const found = await prisma.task.findMany({
        where: { id: { in: body.dependsOn }, projectId: before.projectId },
        select: { id: true },
      });
      if (found.length !== body.dependsOn.length) {
        throw badRequest('Alguna dependencia no existe en este proyecto');
      }

      const graph = await prisma.task.findMany({
        where: { projectId: before.projectId },
        select: { id: true, dependsOn: true },
      });
      if (wouldCreateCycle(before.id, body.dependsOn, graph)) {
        throw badRequest('Esa dependencia crearía un ciclo: las tareas se esperarían entre sí');
      }
    }

    const movesToDone = body.status === 'done' && before.status !== 'done';
    const leavesDone = body.status !== undefined && body.status !== 'done' && before.status === 'done';

    const data = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.pipelineId !== undefined ? { pipelineId: body.pipelineId } : {}),
      ...(body.startDate !== undefined ? { startDate: parseDateOnly(body.startDate) } : {}),
      ...(body.dueDate !== undefined ? { dueDate: parseDateOnly(body.dueDate) } : {}),
      ...(body.estimatedHours !== undefined ? { estimatedHours: body.estimatedHours ?? null } : {}),
      ...(body.actualHours !== undefined ? { actualHours: body.actualHours ?? null } : {}),
      ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId ?? null } : {}),
      ...(body.parentTaskId !== undefined ? { parentTaskId: body.parentTaskId ?? null } : {}),
      ...(body.dependsOn !== undefined ? { dependsOn: body.dependsOn } : {}),
      ...(body.objectiveId !== undefined ? { objectiveId: body.objectiveId ?? null } : {}),
      ...(body.labels !== undefined ? { labels: body.labels } : {}),
      ...(movesToDone ? { completedAt: new Date() } : {}),
      ...(leavesDone ? { completedAt: null } : {}),
    };

    const history = TRACKED_FIELDS.flatMap((field) => {
      if (!(field in data)) return [];
      const oldValue = asText(before[field]);
      const newValue = asText(data[field as keyof typeof data]);
      if (oldValue === newValue) return [];

      return [{ changedById: userId, changeType: describeChange(field), field, oldValue, newValue }];
    });

    await prisma.task.update({
      where: { id: before.id },
      data: { ...data, ...(history.length > 0 ? { history: { create: history } } : {}) },
    });

    await rescoreProject(userId, before.projectId);

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: before.id },
      include: taskInclude,
    });

    res.json({
      task: { ...toTask(task), project: task.project, assignedTo: task.assignedTo },
    });
  }),
);

/** Reordenar dentro de un pipeline o moverla a otro, en una sola operacion. */
tasksRouter.patch(
  '/:id/move',
  asyncRoute(async (req, res) => {
    const body = z
      .object({ pipelineId: uuidSchema, position: z.number().int().min(0) })
      .parse(req.body);
    const userId = currentUserId(req);

    const task = await prisma.task.findFirst({
      where: { id: idParam(req), project: { userId } },
      select: { id: true, projectId: true, pipelineId: true, position: true, status: true },
    });
    if (!task) throw notFound('Tarea no encontrada');

    const pipeline = await assertPipelineAccess(body.pipelineId, userId);
    if (pipeline.projectId !== task.projectId) {
      throw badRequest('El pipeline pertenece a otro proyecto');
    }

    // Reasignar posiciones en bloque: deja el orden compacto y sin empates.
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.task.findMany({
        where: { pipelineId: body.pipelineId, id: { not: task.id } },
        orderBy: { position: 'asc' },
        select: { id: true },
      });

      const ordered = [...siblings];
      ordered.splice(Math.min(body.position, ordered.length), 0, { id: task.id });

      await tx.task.update({
        where: { id: task.id },
        data: { pipelineId: body.pipelineId },
      });

      await Promise.all(
        ordered.map((row, index) =>
          tx.task.update({ where: { id: row.id }, data: { position: index } }),
        ),
      );
    });

    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: taskInclude,
    });

    res.json({
      task: { ...toTask(updated), project: updated.project, assignedTo: updated.assignedTo },
    });
  }),
);

tasksRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = currentUserId(req);
    const task = await assertTaskAccess(idParam(req), userId);

    // Dejar el id en dependsOn de otras tareas apuntaria al vacio.
    const dependents = await prisma.task.findMany({
      where: { projectId: task.projectId, dependsOn: { has: task.id } },
      select: { id: true, dependsOn: true },
    });

    await prisma.$transaction([
      ...dependents.map((dependent) =>
        prisma.task.update({
          where: { id: dependent.id },
          data: { dependsOn: dependent.dependsOn.filter((id) => id !== task.id) },
        }),
      ),
      prisma.task.delete({ where: { id: task.id } }),
    ]);

    res.status(204).send();
  }),
);
