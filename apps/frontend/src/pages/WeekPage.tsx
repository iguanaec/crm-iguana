import { useMemo } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { TaskWithRelations } from '@crm/types';
import { useTasks, useUpdateTask } from '../lib/queries.js';
import { TaskRow } from '../components/tasks/TaskRow.js';
import { formatHours, tasksWord } from '../lib/format.js';

const WEEKDAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

interface DayBucket {
  iso: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
  tasks: TaskWithRelations[];
}

function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function WeekPage() {
  const { data: tasks, isLoading } = useTasks({ open: 'true', sort: 'due' });
  const updateTask = useUpdateTask();

  const { days, overdue, undated } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = localIsoDate(today);

    const buckets: DayBucket[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);

      buckets.push({
        iso: localIsoDate(date),
        label: WEEKDAY_NAMES[date.getDay()]!,
        dayNumber: date.getDate(),
        isToday: offset === 0,
        tasks: [],
      });
    }

    const byIso = new Map(buckets.map((bucket) => [bucket.iso, bucket]));
    const overdueTasks: TaskWithRelations[] = [];
    const undatedTasks: TaskWithRelations[] = [];

    for (const task of tasks ?? []) {
      if (!task.dueDate) {
        undatedTasks.push(task);
        continue;
      }
      if (task.dueDate < todayIso) {
        overdueTasks.push(task);
        continue;
      }
      // Lo que cae despues de estos siete dias no entra en esta vista.
      byIso.get(task.dueDate)?.tasks.push(task);
    }

    return { days: buckets, overdue: overdueTasks, undated: undatedTasks };
  }, [tasks]);

  function toggleDone(task: TaskWithRelations) {
    updateTask.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' });
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={20} className="animate-spin text-jade" />
      </div>
    );
  }

  const monthLabel = MONTH_NAMES[new Date().getMonth()];

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <p className="metric text-xs uppercase tracking-[0.2em] text-ink-mute">{monthLabel}</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">La semana</h1>
      </header>

      {overdue.length > 0 && (
        <section className="panel mt-8 overflow-hidden border-coral/25">
          <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <AlertCircle size={14} className="text-coral" />
            <h2 className="font-display text-base text-ink">Quedaron atrás</h2>
            <span className="metric text-xs text-coral">{overdue.length}</span>
          </header>
          <div className="divide-y divide-line">
            {overdue.map((task) => (
              <TaskRow key={task.id} task={task} onToggleDone={toggleDone} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-3">
        {days.map((day) => {
          const hours = day.tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);

          return (
            <section
              key={day.iso}
              className={`overflow-hidden rounded-card border ${
                day.isToday ? 'border-jade/35 bg-surface-1' : 'border-line bg-surface-1/50'
              }`}
            >
              <header className="flex items-baseline gap-3 px-5 py-3">
                <span
                  className={`metric text-2xl ${day.isToday ? 'text-jade' : 'text-ink-soft'}`}
                >
                  {day.dayNumber}
                </span>
                <h2
                  className={`text-sm ${day.isToday ? 'text-ink' : 'text-ink-soft'}`}
                >
                  {day.isToday ? 'hoy' : day.label}
                </h2>

                {day.tasks.length > 0 ? (
                  <span className="metric ml-auto text-xs text-ink-mute">
                    {tasksWord(day.tasks.length)} · {formatHours(hours)}
                  </span>
                ) : (
                  <span className="metric ml-auto text-xs text-ink-mute">libre</span>
                )}
              </header>

              {day.tasks.length > 0 && (
                <div className="divide-y divide-line border-t border-line">
                  {day.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggleDone={toggleDone}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {undated.length > 0 && (
        <section className="panel mt-8 overflow-hidden">
          <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <Inbox size={14} className="text-ink-mute" />
            <h2 className="font-display text-base text-ink">Sin fecha</h2>
            <span className="metric text-xs text-ink-mute">{undated.length}</span>
          </header>
          <div className="divide-y divide-line">
            {undated.map((task) => (
              <TaskRow key={task.id} task={task} onToggleDone={toggleDone} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
