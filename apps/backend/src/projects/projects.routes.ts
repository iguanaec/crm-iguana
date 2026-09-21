import { Router } from 'express';
import { z } from 'zod';
import { PROJECT_STATUSES } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, badRequest, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { assertClientAccess, assertPipelineAccess, assertProjectAccess } from '../http/ownership.js';
import { parseDateOnly, toPipeline, toProject } from '../http/serialize.js';
import { dateOnlySchema, hexColorSchema, idParam, uuidSchema } from '../http/schemas.js';

/** Un proyecto nuevo nace usable: sin columnas no se puede crear una tarea. */
const DEFAULT_PIPELINES = [
  { name: 'Por hacer', position: 0, color: '#6b7a73' },
  { name: 'En curso', position: 1, color: '#5b9dd9' },
  { name: 'Revisión', position: 2, color: '#f5a524' },
  { name: 'Listo', position: 3, color: '#2dd4a7' },
];

const createSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').trim(),
  description: z.string().trim().max(5000).nullish(),
  clientId: uuidSchema.nullish(),
  color: hexColorSchema.optional(),
  startDate: dateOnlySchema.nullish(),
  endDate: dateOnlySchema.nullish(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

const updateSchema = createSchema.partial();

const pipelineSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').trim(),
  color: hexColorSchema.nullish(),
  position: z.number().int().min(0).optional(),
});

export const projectsRouter = Router();

projectsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = z.object({ status: z.enum(PROJECT_STATUSES).optional() }).parse(req.query);

    const projects = await prisma.project.findMany({
      where: {
        userId: currentUserId(req),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      items: projects.map((project) => ({
        ...toProject(project),
        taskCount: project._count.tasks,
      })),
    });
  }),
);

projectsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const project = await prisma.project.findFirst({
      where: { id: idParam(req), userId: currentUserId(req) },
      include: {
        client: { select: { id: true, name: true, company: true } },
        pipelines: { orderBy: { position: 'asc' } },
      },
    });
    if (!project) throw notFound('Proyecto no encontrado');

    res.json({ project: toProject(project), pipelines: project.pipelines.map(toPipeline) });
  }),
);

projectsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = createSchema.parse(req.body);
    const userId = currentUserId(req);

    if (body.clientId) await assertClientAccess(body.clientId, userId);

    const project = await prisma.project.create({
      data: {
        userId,
        name: body.name,
        description: body.description ?? null,
        clientId: body.clientId ?? null,
        ...(body.color ? { color: body.color } : {}),
        ...(body.status ? { status: body.status } : {}),
        startDate: parseDateOnly(body.startDate),
        endDate: parseDateOnly(body.endDate),
        pipelines: { create: DEFAULT_PIPELINES },
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        pipelines: { orderBy: { position: 'asc' } },
      },
    });

    res.status(201).json({
      project: toProject(project),
      pipelines: project.pipelines.map(toPipeline),
    });
  }),
);

projectsRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const userId = currentUserId(req);
    await assertProjectAccess(idParam(req), userId);

    if (body.clientId) await assertClientAccess(body.clientId, userId);

    const project = await prisma.project.update({
      where: { id: idParam(req) },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId ?? null } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startDate !== undefined ? { startDate: parseDateOnly(body.startDate) } : {}),
        ...(body.endDate !== undefined ? { endDate: parseDateOnly(body.endDate) } : {}),
      },
      include: { client: { select: { id: true, name: true, company: true } } },
    });

    res.json({ project: toProject(project) });
  }),
);

projectsRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    await assertProjectAccess(idParam(req), currentUserId(req));
    await prisma.project.delete({ where: { id: idParam(req) } });
    res.status(204).send();
  }),
);

projectsRouter.get(
  '/:id/pipelines',
  asyncRoute(async (req, res) => {
    await assertProjectAccess(idParam(req), currentUserId(req));

    const pipelines = await prisma.pipeline.findMany({
      where: { projectId: idParam(req) },
      orderBy: { position: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });

    res.json({
      items: pipelines.map((p) => ({ ...toPipeline(p), taskCount: p._count.tasks })),
    });
  }),
);

projectsRouter.post(
  '/:id/pipelines',
  asyncRoute(async (req, res) => {
    const body = pipelineSchema.parse(req.body);
    await assertProjectAccess(idParam(req), currentUserId(req));

    const position =
      body.position ??
      (await prisma.pipeline.count({ where: { projectId: idParam(req) } }));

    const pipeline = await prisma.pipeline.create({
      data: {
        projectId: idParam(req),
        name: body.name,
        color: body.color ?? null,
        position,
      },
    });

    res.status(201).json({ pipeline: toPipeline(pipeline) });
  }),
);

projectsRouter.patch(
  '/pipelines/:pipelineId',
  asyncRoute(async (req, res) => {
    const body = pipelineSchema.partial().parse(req.body);
    await assertPipelineAccess(idParam(req, 'pipelineId'), currentUserId(req));

    const pipeline = await prisma.pipeline.update({
      where: { id: idParam(req, 'pipelineId') },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.color !== undefined ? { color: body.color ?? null } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      },
    });

    res.json({ pipeline: toPipeline(pipeline) });
  }),
);

projectsRouter.delete(
  '/pipelines/:pipelineId',
  asyncRoute(async (req, res) => {
    const pipeline = await assertPipelineAccess(idParam(req, 'pipelineId'), currentUserId(req));

    // Borrar el pipeline arrastra sus tareas: exigir que este vacio evita perderlas.
    const taskCount = await prisma.task.count({ where: { pipelineId: pipeline.id } });
    if (taskCount > 0) {
      throw badRequest(
        `El pipeline tiene ${taskCount} tarea(s). Muévelas antes de eliminarlo.`,
      );
    }

    await prisma.pipeline.delete({ where: { id: pipeline.id } });
    res.status(204).send();
  }),
);
