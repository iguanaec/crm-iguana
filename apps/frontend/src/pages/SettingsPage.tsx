import { useState } from 'react';
import { CheckCircle2, Loader2, Play, Trash2, XCircle } from 'lucide-react';
import type { IntegrationConfig, IntegrationPlatform } from '@crm/types';
import {
  useIntegrations,
  usePreferences,
  useRemoveIntegration,
  useRunChecks,
  useSaveIntegration,
  useTestIntegration,
  useUpdatePreferences,
} from '../lib/queries.js';

const PLATFORMS: Array<{
  id: IntegrationPlatform;
  name: string;
  hint: string;
  example: string;
}> = [
  {
    id: 'discord',
    name: 'Discord',
    hint: 'En tu servidor: Ajustes del canal → Integraciones → Webhooks → Nuevo webhook.',
    example: 'https://discord.com/api/webhooks/…',
  },
  {
    id: 'slack',
    name: 'Slack',
    hint: 'En api.slack.com/apps: crea una app, activa Incoming Webhooks y añade uno al canal.',
    example: 'https://hooks.slack.com/services/…',
  },
];

export function SettingsPage() {
  const { data: preferences } = usePreferences();
  const { data: integrations } = useIntegrations();
  const updatePreferences = useUpdatePreferences();
  const runChecks = useRunChecks();

  const prefs = preferences?.preferences;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-ink">Ajustes</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Cuándo te avisa el asistente y por dónde.
        </p>
      </header>

      <section className="panel mt-8 p-5">
        <h2 className="font-display text-lg text-ink">Avisos</h2>
        <p className="mt-1 text-xs text-ink-mute">
          Como máximo tres al día, para que sigan significando algo.
        </p>

        <div className="mt-5 space-y-1">
          <Toggle
            label="Resumen cada mañana"
            description="Por dónde empezar, qué venció y qué es para hoy."
            checked={prefs?.notifyDailyDigest ?? true}
            onChange={(value) => updatePreferences.mutate({ notifyDailyDigest: value })}
          />
          <Toggle
            label="Vencimientos"
            description="Aviso con dos días de margen, una vez por tarea."
            checked={prefs?.notifyDeadlines ?? true}
            onChange={(value) => updatePreferences.mutate({ notifyDeadlines: value })}
          />
        </div>

        <label className="mt-5 flex items-center gap-3 border-t border-line pt-5">
          <span className="text-sm text-ink-soft">Hora del resumen</span>
          <select
            value={prefs?.digestHour ?? 9}
            onChange={(event) =>
              updatePreferences.mutate({ digestHour: Number(event.target.value) })
            }
            className="metric rounded-lg border border-line bg-surface-0 px-3 py-2 text-sm text-ink focus:border-jade focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-mute">en tu zona horaria</span>
        </label>

        <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
          <button
            onClick={() => runChecks.mutate()}
            disabled={runChecks.isPending}
            className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-soft transition-colors hover:border-jade hover:text-jade disabled:opacity-50"
          >
            {runChecks.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            Revisar ahora
          </button>
          {runChecks.data && (
            <p className="text-xs text-ink-mute">
              {runChecks.data.digests + runChecks.data.deadlines === 0
                ? 'Nada nuevo que avisar.'
                : `${runChecks.data.digests} resumen, ${runChecks.data.deadlines} de vencimiento.`}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-ink">Dónde recibirlos</h2>
          <p className="mt-1 text-xs text-ink-mute">
            Los avisos siempre quedan en la app. Estos canales son adicionales y gratuitos.
          </p>
        </div>

        {PLATFORMS.map((platform) => (
          <IntegrationCard
            key={platform.id}
            platform={platform}
            current={integrations?.find((i) => i.platform === platform.id)}
          />
        ))}
      </section>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-surface-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-jade)]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-ink-mute">{description}</span>
      </span>
    </label>
  );
}

function IntegrationCard({
  platform,
  current,
}: {
  platform: (typeof PLATFORMS)[number];
  current: IntegrationConfig | undefined;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useSaveIntegration();
  const test = useTestIntegration();
  const remove = useRemoveIntegration();

  const isConnected = Boolean(current);

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-base text-ink">{platform.name}</h3>

        {isConnected && (
          <div className="flex items-center gap-3">
            {current?.lastDeliveryOk === true && (
              <span className="metric flex items-center gap-1.5 text-[0.7rem] text-jade">
                <CheckCircle2 size={12} />
                último envío ok
              </span>
            )}
            {current?.lastDeliveryOk === false && (
              <span className="metric flex items-center gap-1.5 text-[0.7rem] text-coral">
                <XCircle size={12} />
                falló el último envío
              </span>
            )}
            <span className="metric text-[0.7rem] text-ink-mute">
              {current?.webhookUrlMasked}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-mute">{platform.hint}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder={isConnected ? 'Pega otra dirección para reemplazarla' : platform.example}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-mute focus:border-jade focus:outline-none"
        />

        <button
          onClick={() =>
            save.mutate(
              { platform: platform.id, webhookUrl: url.trim() },
              {
                onSuccess: () => {
                  setUrl('');
                  setError(null);
                },
                onError: (err) =>
                  setError(err instanceof Error ? err.message : 'No se pudo guardar'),
              },
            )
          }
          disabled={save.isPending || url.trim().length === 0}
          className="rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow disabled:opacity-40"
        >
          {save.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Guardar'}
        </button>
      </div>

      {error && <p className="mt-2.5 text-xs text-coral">{error}</p>}

      {isConnected && (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <button
            onClick={() => test.mutate(platform.id)}
            disabled={test.isPending}
            className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-soft transition-colors hover:border-jade hover:text-jade disabled:opacity-50"
          >
            {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Enviar prueba
          </button>

          <button
            onClick={() => remove.mutate(platform.id)}
            disabled={remove.isPending}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-mute transition-colors hover:text-coral disabled:opacity-50"
          >
            <Trash2 size={13} />
            Quitar
          </button>

          {test.data && (
            <p className={`text-xs ${test.data.ok ? 'text-jade' : 'text-coral'}`}>
              {test.data.ok ? 'Mensaje entregado.' : (test.data.error ?? 'No se pudo entregar.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
