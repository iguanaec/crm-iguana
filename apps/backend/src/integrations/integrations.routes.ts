import { Router } from 'express';
import { z } from 'zod';
import { INTEGRATION_PLATFORMS, NOTIFICATION_TYPES, type IntegrationConfig } from '@crm/types';
import { prisma } from '../db.js';
import { asyncRoute, badRequest, notFound } from '../http/errors.js';
import { currentUserId } from '../auth/auth.service.js';
import { deliver, maskWebhookUrl, validateWebhookUrl } from './delivery.js';

const platformSchema = z.enum(INTEGRATION_PLATFORMS);

const connectSchema = z.object({
  webhookUrl: z.string().min(1, 'Pega la dirección del webhook'),
  notificationTypes: z.array(z.enum(NOTIFICATION_TYPES)).optional(),
  isActive: z.boolean().optional(),
});

/** Por defecto llegan los dos avisos que la persona pidió: resumen y vencimientos. */
const DEFAULT_TYPES = ['daily_digest', 'deadline_approaching'] as const;

type ConfigRow = {
  id: string;
  platform: IntegrationConfig['platform'];
  webhookUrl: string;
  isActive: boolean;
  notificationTypes: IntegrationConfig['notificationTypes'];
  lastDeliveryAt: Date | null;
  lastDeliveryOk: boolean | null;
  createdAt: Date;
};

/** La URL lleva el secreto del webhook: se devuelve enmascarada. */
function present(row: ConfigRow): IntegrationConfig {
  return {
    id: row.id,
    platform: row.platform,
    webhookUrlMasked: maskWebhookUrl(row.webhookUrl),
    isActive: row.isActive,
    notificationTypes: row.notificationTypes,
    lastDeliveryAt: row.lastDeliveryAt ? row.lastDeliveryAt.toISOString() : null,
    lastDeliveryOk: row.lastDeliveryOk,
    createdAt: row.createdAt.toISOString(),
  };
}

function readPlatform(value: string | undefined): IntegrationConfig['platform'] {
  const parsed = platformSchema.safeParse(value);
  if (!parsed.success) throw badRequest('Plataforma no reconocida: usa discord o slack');
  return parsed.data;
}

export const integrationsRouter = Router();

integrationsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const configs = await prisma.integrationConfig.findMany({
      where: { userId: currentUserId(req) },
    });

    res.json({ items: configs.map(present) });
  }),
);

integrationsRouter.put(
  '/:platform',
  asyncRoute(async (req, res) => {
    const platform = readPlatform(req.params.platform);
    const body = connectSchema.parse(req.body);
    const userId = currentUserId(req);

    try {
      validateWebhookUrl(platform, body.webhookUrl);
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : 'Webhook inválido');
    }

    const config = await prisma.integrationConfig.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        webhookUrl: body.webhookUrl,
        notificationTypes: body.notificationTypes ?? [...DEFAULT_TYPES],
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      update: {
        webhookUrl: body.webhookUrl,
        ...(body.notificationTypes ? { notificationTypes: body.notificationTypes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    res.json({ integration: present(config) });
  }),
);

integrationsRouter.post(
  '/:platform/test',
  asyncRoute(async (req, res) => {
    const platform = readPlatform(req.params.platform);

    const config = await prisma.integrationConfig.findUnique({
      where: { userId_platform: { userId: currentUserId(req), platform } },
    });
    if (!config) throw notFound('Esa integración no está configurada');

    const result = await deliver(platform, config.webhookUrl, {
      type: 'daily_digest',
      title: 'Prueba de CRM Iguana',
      body: 'Si ves este mensaje, los avisos llegarán a este canal.',
    });

    await prisma.integrationConfig.update({
      where: { id: config.id },
      data: { lastDeliveryAt: new Date(), lastDeliveryOk: result.ok },
    });

    res.status(result.ok ? 200 : 502).json(result);
  }),
);

integrationsRouter.delete(
  '/:platform',
  asyncRoute(async (req, res) => {
    const platform = readPlatform(req.params.platform);

    const config = await prisma.integrationConfig.findUnique({
      where: { userId_platform: { userId: currentUserId(req), platform } },
      select: { id: true },
    });
    if (!config) throw notFound('Esa integración no está configurada');

    await prisma.integrationConfig.delete({ where: { id: config.id } });
    res.status(204).send();
  }),
);
