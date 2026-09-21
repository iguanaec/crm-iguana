import { prisma } from '../db.js';
import { notFound } from './errors.js';

/**
 * Cada recurso se alcanza solo a traves de su dueño. Se responde 404 en vez de
 * 403 para no confirmar que el id existe cuando pertenece a otra cuenta.
 */

export async function assertClientAccess(clientId: string, userId: string): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });
  if (!client) throw notFound('Cliente no encontrado');
}

export async function assertProjectAccess(projectId: string, userId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw notFound('Proyecto no encontrado');
}

export async function assertObjectiveAccess(objectiveId: string, userId: string): Promise<void> {
  const objective = await prisma.objective.findFirst({
    where: { id: objectiveId, userId },
    select: { id: true },
  });
  if (!objective) throw notFound('Objetivo no encontrado');
}

/** Devuelve el pipeline solo si su proyecto es del usuario. */
export async function assertPipelineAccess(
  pipelineId: string,
  userId: string,
): Promise<{ id: string; projectId: string }> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, project: { userId } },
    select: { id: true, projectId: true },
  });
  if (!pipeline) throw notFound('Pipeline no encontrado');
  return pipeline;
}

export async function assertTaskAccess(
  taskId: string,
  userId: string,
): Promise<{ id: string; projectId: string; pipelineId: string }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { userId } },
    select: { id: true, projectId: true, pipelineId: true },
  });
  if (!task) throw notFound('Tarea no encontrada');
  return task;
}
