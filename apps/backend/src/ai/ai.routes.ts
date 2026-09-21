import { Router } from 'express';
import { z } from 'zod';
import { parseTaskFromText, validateDraft } from '@crm/assistant';
import { prisma } from '../db.js';
import { asyncRoute } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { assertProjectAccess } from '../http/ownership.js';
import { uuidSchema } from '../http/schemas.js';
import { buildInsights, findBottlenecks, recalculatePriorities, suggestNextTask } from './ai.service.js';

export const aiRouter = Router();

aiRouter.post(
  '/prioritize',
  asyncRoute(async (req, res) => {
    const body = z.object({ projectId: uuidSchema.optional() }).parse(req.body ?? {});
    const userId = currentUserId(req);

    if (body.projectId) await assertProjectAccess(body.projectId, userId);

    res.json(await recalculatePriorities(userId, body.projectId));
  }),
);

aiRouter.get(
  '/next-task',
  asyncRoute(async (req, res) => {
    res.json(await suggestNextTask(currentUserId(req)));
  }),
);

aiRouter.get(
  '/bottlenecks',
  asyncRoute(async (req, res) => {
    res.json({ items: await findBottlenecks(currentUserId(req)) });
  }),
);

aiRouter.get(
  '/insights',
  asyncRoute(async (req, res) => {
    res.json(await buildInsights(currentUserId(req)));
  }),
);

/**
 * Lee una frase y devuelve un borrador de tarea. No guarda nada: la persona
 * revisa y confirma, y ahi se crea con POST /tasks.
 */
aiRouter.post(
  '/parse-task',
  asyncRoute(async (req, res) => {
    const body = z
      .object({ text: z.string().min(3, 'Escribe al menos unas palabras').max(2000) })
      .parse(req.body);

    const userId = currentUserId(req);
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true },
    });

    const draft = parseTaskFromText(body.text, { teamMembers: [me] });

    res.json({ draft, problems: validateDraft(draft) });
  }),
);
