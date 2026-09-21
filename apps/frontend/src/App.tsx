import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth.js';
import { LoginPage } from './pages/LoginPage.js';

export function App() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const restore = useAuth((s) => s.restore);
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <Loader2 size={20} className="animate-spin text-jade" />
      </div>
    );
  }

  if (status === 'anonymous') return <LoginPage />;

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-baseline justify-between border-b border-line pb-6">
          <div>
            <h1 className="font-display text-3xl text-ink">
              Hola, {user?.name.split(' ')[0]}
            </h1>
            <p className="metric mt-1 text-xs uppercase tracking-wider text-ink-mute">
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            Salir
          </button>
        </header>

        <div className="panel-assistant reveal mt-8 p-6">
          <p className="metric text-[0.7rem] uppercase tracking-[0.2em] text-jade">Asistente</p>
          <p className="mt-3 text-ink-soft">
            Sesión activa. El dashboard, los pipelines y la vista semanal se conectan en el
            siguiente paso.
          </p>
        </div>
      </div>
    </div>
  );
}
