import { Router } from 'express';
import { z } from 'zod';
import { OBJECTIVE_TYPES, type ObjectiveProgress } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { assertObjectiveAccess, assertProjectAccess } from '../http/ownership.js';
import { parseDateOnly, toObjective } from '../http/serialize.js';
import { dateOnlySchema, idParam, uuidSchema } from '../http/schemas.js';

const createSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').trim(),
  description: z.string().trim().max(5000).nullish(),
  projectId: uuidSchema.nullish(),
  goalType: z.enum(OBJECTIVE_TYPES).optional(),
  targetValue: z.number().positive().nullish(),
  currentValue: z.number().min(0).optional(),
  unit: z.string().trim().max(40).nullish(),
  startDate: dateOnlySchema.nullish(),
  endDate: dateOnlySchema.nullish(),
  isCritical: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

type ObjectiveWithCounts = Parameters<typeof toObjective>[0] & {
  tasks: Array<{ status: string }>;
};

/**
 * Un objetivo de tipo "completion" se mide por sus tareas terminadas; los demas
 * por el valor que se reporta a mano.
 */
function withProgress(objective: ObjectiveWithCounts): ObjectiveProgress {
  const linkedTaskCount = objective.tasks.length;
  const completedTaskCount = objective.tasks.filter((t) => t.status === 'done').length;

  let progressPercentage: number;
  if (objective.goalType === 'completion' && linkedTaskCount > 0) {
    progressPercentage = Math.round((completedTaskCount / linkedTaskCount) * 100);
  } else if (objective.targetValue && objective.targetValue > 0) {
    progressPercentage = Math.min(
      100,
      Math.round((objective.currentValue / objective.targetValue) * 100),
    );
  } else {
    progressPercentage = 0;
  }

  return { ...toObjective(objective), progressPercentage, linkedTaskCount, completedTaskCount };
}

export const objectivesRouter = Router();

objectivesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = z.object({ projectId: uuidSchema.optional() }).parse(req.query);
    const userId = currentUserId(req);

    if (query.projectId) await assertProjectAccess(query.projectId, userId);

    const objectives = await prisma.objective.findMany({
      where: { userId, ...(query.projectId ? { projectId: query.projectId } : {}) },
      include: { tasks: { select: { status: true } } },
      orderBy: [{ isCritical: 'desc' }, { endDate: 'asc' }],
    });

    res.json({ items: objectives.map(withProgress) });
  }),
);

objectivesRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const objective = await prisma.objective.findFirst({
      where: { id: idParam(req), userId: currentUserId(req) },
      include: { tasks: { select: { status: true } } },
    });
    if (!objective) throw notFound('Objetivo no encontrado');

    res.json({ objective: withProgress(objective) });
  }),
);

objectivesRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = createSchema.parse(req.body);
    const userId = currentUserId(req);

    if (body.projectId) await assertProjectAccess(body.projectId, userId);

    const objective = await prisma.objective.create({
      data: {
        userId,
        title: body.title,
        description: body.description ?? null,
        projectId: body.projectId ?? null,
        ...(body.goalType ? { goalType: body.goalType } : {}),
        targetValue: body.targetValue ?? null,
        ...(body.currentValue !== undefined ? { currentValue: body.currentValue } : {}),
        unit: body.unit ?? null,
        startDate: parseDateOnly(body.startDate),
        endDate: parseDateOnly(body.endDate),
        ...(body.isCritical !== undefined ? { isCritical: body.isCritical } : {}),
      },
      include: { tasks: { select: { status: true } } },
    });

    res.status(201).json({ objective: withProgress(objective) });
  }),
);

objectivesRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const userId = currentUserId(req);
    await assertObjectiveAccess(idParam(req), userId);

    if (body.projectId) await assertProjectAccess(body.projectId, userId);

    const objective = await prisma.objective.update({
      where: { id: idParam(req) },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId ?? null } : {}),
        ...(body.goalType !== undefined ? { goalType: body.goalType } : {}),
        ...(body.targetValue !== undefined ? { targetValue: body.targetValue ?? null } : {}),
        ...(body.currentValue !== undefined ? { currentValue: body.currentValue } : {}),
        ...(body.unit !== undefined ? { unit: body.unit ?? null } : {}),
        ...(body.startDate !== undefined ? { startDate: parseDateOnly(body.startDate) } : {}),
        ...(body.endDate !== undefined ? { endDate: parseDateOnly(body.endDate) } : {}),
        ...(body.isCritical !== undefined ? { isCritical: body.isCritical } : {}),
      },
      include: { tasks: { select: { status: true } } },
    });

    res.json({ objective: withProgress(objective) });
  }),
);

objectivesRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    await assertObjectiveAccess(idParam(req), currentUserId(req));
    // Las tareas quedan sin objetivo, no se borran (onDelete: SetNull).
    await prisma.objective.delete({ where: { id: idParam(req) } });
    res.status(204).send();
  }),
);
