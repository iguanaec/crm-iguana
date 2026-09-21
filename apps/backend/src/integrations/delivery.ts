import type { IntegrationPlatform, NotificationType } from '@crm/types';

/**
 * Solo estos hosts. La URL la escribe la persona, y el servidor es quien hace
 * la peticion: sin esta lista, una direccion interna convertiria al backend en
 * un proxy hacia la red privada.
 */
const ALLOWED_HOSTS: Record<IntegrationPlatform, string[]> = {
  discord: ['discord.com', 'discordapp.com'],
  slack: ['hooks.slack.com'],
};

export function validateWebhookUrl(platform: IntegrationPlatform, rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('La dirección del webhook no es una URL válida');
  }

  if (url.protocol !== 'https:') {
    throw new Error('El webhook debe usar https');
  }

  const allowed = ALLOWED_HOSTS[platform];
  if (!allowed.includes(url.hostname)) {
    throw new Error(
      `Para ${platform} la dirección debe ser de ${allowed.join(' o ')}`,
    );
  }

  return url;
}

/** Oculta el secreto del webhook al devolverlo: basta ver de donde es. */
export function maskWebhookUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.hostname}/…${rawUrl.slice(-6)}`;
  } catch {
    return '…';
  }
}

const ACCENT: Record<NotificationType, number> = {
  daily_digest: 0x2dd4a7,
  deadline_approaching: 0xf5a524,
  priority_changed: 0x5b9dd9,
  task_assigned: 0x5b9dd9,
  bottleneck_detected: 0xef6461,
};

export interface OutgoingMessage {
  type: NotificationType;
  title: string;
  body: string;
}

function discordPayload(message: OutgoingMessage): unknown {
  return {
    embeds: [
      {
        title: message.title,
        description: message.body,
        color: ACCENT[message.type],
        footer: { text: 'CRM Iguana' },
      },
    ],
  };
}

function slackPayload(message: OutgoingMessage): unknown {
  return {
    text: message.title,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: message.title, emoji: false } },
      { type: 'section', text: { type: 'mrkdwn', text: message.body } },
    ],
  };
}

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

/** Entrega un aviso al webhook. Nunca lanza: el fallo se reporta y se registra. */
export async function deliver(
  platform: IntegrationPlatform,
  webhookUrl: string,
  message: OutgoingMessage,
): Promise<DeliveryResult> {
  let url: URL;
  try {
    url = validateWebhookUrl(platform, webhookUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'URL inválida' };
  }

  const payload = platform === 'discord' ? discordPayload(message) : slackPayload(message);

  // Un webhook lento no debe dejar colgado al proceso que envia.
  const abort = AbortController ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), 8000) : null;

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(abort ? { signal: abort.signal } : {}),
    });

    if (!response.ok) {
      return { ok: false, error: `El servicio respondió ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
        ? 'El webhook tardó demasiado'
        : error instanceof Error
          ? error.message
          : 'Fallo de red';
    return { ok: false, error: reason };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
