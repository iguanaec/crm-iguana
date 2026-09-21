import {
  MAX_NOTIFICATIONS_PER_DAY,
  composeDailyDigest,
  composeDeadlineAlert,
  shouldAlertDeadline,
  type NotifiableTask,
} from '@crm/assistant';
import type { NotificationType } from '@crm/types';
import { prisma } from '../db.js';
import { deliver } from '../integrations/delivery.js';
import { buildInsights } from '../ai/ai.service.js';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string | null;
  projectId?: string | null;
  /** El resumen diario es lo que la persona pidió recibir: no gasta el tope. */
  bypassDailyCap?: boolean;
}

function startOfUtcDay(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Registra el aviso y lo reenvia a los canales que la persona activo. El tope
 * diario solo limita lo que el asistente decide por su cuenta.
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  if (!input.bypassDailyCap) {
    const sentToday = await prisma.notification.count({
      where: { userId: input.userId, createdAt: { gte: startOfUtcDay() } },
    });
    if (sentToday >= MAX_NOTIFICATIONS_PER_DAY) return false;
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
    },
  });

  const integrations = await prisma.integrationConfig.findMany({
    where: { userId: input.userId, isActive: true, notificationTypes: { has: input.type } },
  });

  for (const integration of integrations) {
    const result = await deliver(integration.platform, integration.webhookUrl, {
      type: input.type,
      title: input.title,
      body: input.message,
    });

    await prisma.integrationConfig.update({
      where: { id: integration.id },
      data: { lastDeliveryAt: new Date(), lastDeliveryOk: result.ok },
    });

    if (!result.ok) {
      console.warn(`Aviso no entregado a ${integration.platform}: ${result.error}`);
    }
  }

  return true;
}

function toNotifiable(task: {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: Date | null;
  aiPriorityScore: number | null;
  project?: { name: string };
}): NotifiableTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    aiPriorityScore: task.aiPriorityScore,
    ...(task.project ? { projectName: task.project.name } : {}),
  };
}

/** Hora local de la persona segun su zona, para no despertarla de madrugada. */
function localHour(timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return Number.parseInt(formatted, 10) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Manda el resumen a quienes en su zona acaban de llegar a la hora elegida.
 * Se ejecuta cada hora; el registro del dia evita repetirlo.
 */
export async function runDailyDigest(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { notifyDailyDigest: true },
    select: { id: true, timezone: true, digestHour: true },
  });

  let sent = 0;

  for (const user of users) {
    if (localHour(user.timezone) !== user.digestHour) continue;

    const already = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'daily_digest', createdAt: { gte: startOfUtcDay() } },
      select: { id: true },
    });
    if (already) continue;

    const insights = await buildInsights(user.id);

    const digest = composeDailyDigest({
      recommended: insights.nextTask.task
        ? toNotifiable({
            ...insights.nextTask.task,
            dueDate: insights.nextTask.task.dueDate
              ? new Date(`${insights.nextTask.task.dueDate}T00:00:00Z`)
              : null,
          })
        : null,
      recommendedReason: insights.nextTask.reason,
      overdue: insights.overdue.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(`${task.dueDate}T00:00:00Z`) : null,
        aiPriorityScore: task.aiPriorityScore,
      })),
      dueToday: insights.dueToday.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(`${task.dueDate}T00:00:00Z`) : null,
        aiPriorityScore: task.aiPriorityScore,
      })),
      blockedCount: insights.bottlenecks.reduce((sum, b) => sum + b.blockingCount, 0),
    });

    if (!digest.worthSending) continue;

    await notify({
      userId: user.id,
      type: 'daily_digest',
      title: digest.title,
      message: digest.message,
      bypassDailyCap: true,
    });
    sent += 1;
  }

  return sent;
}

/** Avisa de lo que esta por vencer, una sola vez por tarea y por dia. */
export async function runDeadlineScan(): Promise<number> {
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { notifyDeadlines: true },
    select: { id: true },
  });

  let sent = 0;

  for (const user of users) {
    const tasks = await prisma.task.findMany({
      where: {
        project: { userId: user.id, status: 'active' },
        status: { not: 'done' },
        dueDate: { not: null },
      },
      include: { project: { select: { name: true } } },
    });

    const candidates = tasks
      .map(toNotifiable)
      .filter((task) => shouldAlertDeadline(task, now));

    if (candidates.length === 0) continue;

    const alreadyAlerted = await prisma.notification.findMany({
      where: {
        userId: user.id,
        type: 'deadline_approaching',
        taskId: { in: candidates.map((t) => t.id) },
        createdAt: { gte: startOfUtcDay() },
      },
      select: { taskId: true },
    });
    const alertedIds = new Set(alreadyAlerted.map((n) => n.taskId));

    for (const task of candidates) {
      if (alertedIds.has(task.id)) continue;

      const alert = composeDeadlineAlert(task, now);
      const delivered = await notify({
        userId: user.id,
        type: 'deadline_approaching',
        title: alert.title,
        message: alert.message,
        taskId: task.id,
      });

      if (!delivered) break; // Se alcanzo el tope diario: el resto espera.
      sent += 1;
    }
  }

  return sent;
}
