import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, FolderKanban, LogOut, Sparkles, Target, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { useAssistantPanel } from './assistant/assistantPanel.js';

const NAV = [
  { to: '/', label: 'Hoy', icon: CalendarDays },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/objetivos', label: 'Objetivos', icon: Target },
];

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const openAssistant = useAssistantPanel((s) => s.open);

  return (
    <div className="flex min-h-screen bg-surface-0">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface-1">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <span
            aria-hidden
            className="h-6 w-1.5 rounded-full"
            style={{ background: 'linear-gradient(to bottom, var(--color-jade), var(--color-jade-deep))' }}
          />
          <span className="font-display text-lg font-medium tracking-tight text-ink">
            Iguana
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}

          <button
            onClick={() => openAssistant()}
            className="mt-4 flex items-center gap-3 rounded-lg border border-line-strong px-3 py-2.5 text-sm text-jade transition-colors duration-150 hover:bg-surface-2"
          >
            <Sparkles size={17} strokeWidth={1.75} />
            Nueva tarea
            <kbd className="metric ml-auto rounded border border-line px-1.5 py-0.5 text-[0.65rem] text-ink-mute">
              N
            </kbd>
          </button>
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-jade">
              {user?.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{user?.name}</p>
              <p className="metric truncate text-[0.65rem] text-ink-mute">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Salir"
              aria-label="Salir"
              className="shrink-0 rounded-md p-1.5 text-ink-mute transition-colors hover:bg-surface-3 hover:text-coral"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
