import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, CheckCheck, GitBranch, Sparkles } from 'lucide-react';
import type { Notification, NotificationType } from '@crm/types';
import { useMarkAllRead, useMarkRead, useNotifications } from '../../lib/queries.js';

const ICON: Record<NotificationType, typeof Bell> = {
  daily_digest: Sparkles,
  deadline_approaching: CalendarClock,
  priority_changed: Sparkles,
  task_assigned: Bell,
  bottleneck_detected: GitBranch,
};

const TONE: Record<NotificationType, string> = {
  daily_digest: 'text-jade',
  deadline_approaching: 'text-amber',
  priority_changed: 'text-azure',
  task_assigned: 'text-azure',
  bottleneck_detected: 'text-coral',
};

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

export function NotificationBell() {
  const [isOpen, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Un clic fuera cierra el panel: no hace falta apuntar de nuevo a la campana.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((open) => !open)}
        aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : 'Avisos'}
        className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
      >
        <Bell size={17} strokeWidth={1.75} />
        Avisos
        {unread > 0 && (
          <span className="metric ml-auto rounded-full bg-jade px-1.5 py-0.5 text-[0.6rem] font-semibold text-surface-0">
            {unread}
          </span>
        )}
      </button>

      {/* Se posiciona contra la ventana, no contra el botón: anclado al botón
          se salía de pantalla por arriba o por abajo según su altura. */}
      {isOpen && (
        <div className="panel reveal fixed left-[15.5rem] top-16 z-40 flex max-h-[calc(100vh-8rem)] w-80 flex-col overflow-hidden shadow-2xl">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <h2 className="metric text-[0.7rem] uppercase tracking-wider text-ink-soft">Avisos</h2>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1.5 text-xs text-ink-mute transition-colors hover:text-jade"
              >
                <CheckCheck size={13} />
                Marcar todo
              </button>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!data || data.items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-mute">
                Nada por ahora. El asistente avisa cada mañana y cuando algo está por vencer.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {data.items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markRead.mutate(notification.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const Icon = ICON[notification.type];

  return (
    <li
      className={`flex gap-3 px-4 py-3 transition-colors ${
        notification.isRead ? 'opacity-55' : 'bg-surface-1'
      }`}
    >
      <Icon size={14} className={`mt-0.5 shrink-0 ${TONE[notification.type]}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">{notification.title}</p>
        {/* El resumen llega con saltos de línea: conservarlos lo hace legible. */}
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
          {notification.message}
        </p>
        <p className="metric mt-1.5 text-[0.65rem] text-ink-mute">
          {relativeTime(notification.createdAt)}
        </p>
      </div>

      {!notification.isRead && (
        <button
          onClick={onRead}
          aria-label="Marcar como leído"
          title="Marcar como leído"
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-jade transition-transform hover:scale-150"
        />
      )}
    </li>
  );
}
