import { useState, type FormEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);

    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) {
          setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        }
      } else {
        setError('No se pudo conectar con el servidor.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-0">
      {/* Atmosfera: dos focos jade muy difusos, nada de degradados planos. */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-jade), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-60 right-0 h-[36rem] w-[36rem] rounded-full opacity-[0.05] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-azure), transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <header className="reveal">
            <p className="metric mb-6 text-xs uppercase tracking-[0.35em] text-jade">
              Gestión con asistente
            </p>

            <h1 className="font-display text-6xl leading-[0.92] font-medium tracking-tight text-ink sm:text-7xl">
              CRM
              <br />
              <span className="text-jade">Iguana</span>
            </h1>

            <p className="mt-8 max-w-md text-lg leading-relaxed text-ink-soft">
              Clientes, proyectos y tareas en un solo lugar. El asistente calcula qué sigue,
              avisa cuando algo se vence y crea tareas desde una frase escrita normal.
            </p>

            <dl className="metric mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-card border border-line">
              {[
                { k: 'Priorización', v: '0–10' },
                { k: 'Avisos', v: 'Diarios' },
                { k: 'Costo', v: 'Libre' },
              ].map((item) => (
                <div key={item.k} className="bg-surface-1 px-4 py-4">
                  <dt className="text-[0.65rem] uppercase tracking-wider text-ink-mute">{item.k}</dt>
                  <dd className="mt-1.5 text-sm text-ink">{item.v}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="panel reveal p-8" style={{ animationDelay: '120ms' }}>
            <div className="mb-8 flex gap-1 rounded-lg bg-surface-0 p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setFieldErrors({});
                  }}
                  className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    mode === m ? 'bg-surface-3 text-ink' : 'text-ink-mute hover:text-ink-soft'
                  }`}
                >
                  {m === 'login' ? 'Entrar' : 'Crear cuenta'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-5" noValidate>
              {mode === 'register' && (
                <Field label="Nombre" error={fieldErrors.name}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Tu nombre"
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="Correo" error={fieldErrors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Contraseña"
                error={fieldErrors.password}
                hint={mode === 'register' ? 'Mínimo 8 caracteres' : undefined}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </Field>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-jade px-5 py-3.5 text-sm font-semibold text-surface-0 transition-all duration-150 hover:bg-jade-glow disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface-0 px-4 py-3 text-sm text-ink placeholder:text-ink-mute transition-colors duration-150 hover:border-line-strong focus:border-jade focus:outline-none';

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="metric mb-2 flex items-baseline justify-between text-[0.7rem] uppercase tracking-wider text-ink-soft">
        {label}
        {hint && !error && <span className="text-ink-mute normal-case tracking-normal">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-coral">{error}</span>}
    </label>
  );
}
