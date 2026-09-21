import { describe, expect, it } from 'vitest';
import { maskWebhookUrl, validateWebhookUrl } from './delivery.js';

describe('validateWebhookUrl', () => {
  it('acepta un webhook legitimo de Discord', () => {
    expect(() =>
      validateWebhookUrl('discord', 'https://discord.com/api/webhooks/123/abc'),
    ).not.toThrow();
  });

  it('acepta un webhook legitimo de Slack', () => {
    expect(() =>
      validateWebhookUrl('slack', 'https://hooks.slack.com/services/T0/B0/xyz'),
    ).not.toThrow();
  });

  it('rechaza direcciones internas: el servidor no debe servir de puente', () => {
    for (const url of [
      'https://localhost/webhook',
      'https://127.0.0.1/webhook',
      'https://169.254.169.254/latest/meta-data',
      'https://10.0.0.5/interno',
      'https://postgres.svc.cluster.local/',
    ]) {
      expect(() => validateWebhookUrl('discord', url), url).toThrow();
    }
  });

  it('rechaza un host que solo se parece al permitido', () => {
    expect(() => validateWebhookUrl('discord', 'https://discord.com.atacante.io/x')).toThrow();
    expect(() => validateWebhookUrl('slack', 'https://nothooks.slack.com.evil/x')).toThrow();
  });

  it('exige https', () => {
    expect(() => validateWebhookUrl('discord', 'http://discord.com/api/webhooks/1/a')).toThrow(
      /https/,
    );
  });

  it('no permite cruzar plataformas', () => {
    expect(() => validateWebhookUrl('slack', 'https://discord.com/api/webhooks/1/a')).toThrow();
  });

  it('rechaza texto que no es una URL', () => {
    expect(() => validateWebhookUrl('discord', 'no soy una url')).toThrow();
  });
});

describe('maskWebhookUrl', () => {
  it('deja ver el servicio pero no el secreto', () => {
    const masked = maskWebhookUrl('https://discord.com/api/webhooks/123456/secretoLargo');
    expect(masked).toContain('discord.com');
    expect(masked).not.toContain('secretoLargo');
  });
});
