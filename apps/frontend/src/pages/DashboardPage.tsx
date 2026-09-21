import { AlertTriangle, ArrowRight, GitBranch, Loader2, RefreshCw, Sparkles, Target } from 'lucide-react';
import type { ObjectiveProgress, TaskWithRelations } from '@crm/types';
import { useInsights, usePrioritize, useUpdateTask } from '../lib/queries.js';
import { useAuth } from '../lib/auth.js';
import { TaskRow } from '../components/tasks/TaskRow.js';
import { WeekLoadChart } from '../components/dashboard/WeekLoadChart.js';
import { useAssistantPanel } from '../components/assistant/assistantPanel.js';
import { PRIORITY_LABEL, formatAmount, formatScore } from '../lib/format.js';

export function DashboardPage() {
  const { data: insights, isLoading } = useInsights();
  const user = useAuth((s) => s.user);
  const updateTask = useUpdateTask();
  const prioritize = usePrioritize();
  const openAssistant = useAssistantPanel((s) => s.open);

  function toggleDone(task: TaskWithRelations) {
    updateTask.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' });
  }

  if (isLoading || !insights) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={20} className="animate-spin text-jade" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const next = insights.nextTask;
  const criticalObjectives = insights.objectiveProgress.filter((o) => o.isCritical).length;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="metric text-xs uppercase tracking-[0.2em] text-ink-mute">{today}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Hola, {user?.name.split(' ')[0]}
          </h1>
        </div>

        <button
          onClick={() => prioritize.mutate(undefined)}
          disabled={prioritize.isPending}
          className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={13} className={prioritize.isPending ? 'animate-spin' : ''} />
          Recalcular
        </button>
      </header>

      {/* Lo que el asistente recomienda: primero, y visualmente distinto. */}
      <section className="panel-assistant reveal mt-8 p-6">
        <div className="flex items-center gap-2.5">
          <Sparkles size={15} className="text-jade" />
          <h2 className="metric text-xs uppercase tracking-[0.2em] text-jade">
            Empieza por esto
          </h2>
        </div>

        {next.task ? (
          <>
            <div className="mt-4 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="font-display text-2xl leading-snug tracking-tight text-ink">
                  {next.task.title}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{next.reason}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className={`metric text-3xl ${next.task.aiPriorityScore! >= 7 ? 'text-coral' : 'text-jade'}`}>
                  {formatScore(next.task.aiPriorityScore)}
                </p>
                <p className="metric mt-0.5 text-[0.6rem] uppercase tracking-wider text-ink-mute">
                  puntaje
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                onClick={() => toggleDone(next.task!)}
                className="flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-xs font-semibold text-surface-0 transition-colors hover:bg-jade-glow"
              >
                Marcar lista
                <ArrowRight size={13} />
              </button>

              {next.alternatives.length > 0 && (
                <p className="text-xs text-ink-mute">
                  o sigue con{' '}
                  <span className="text-ink-soft">{next.alternatives[0]!.task.title}</span>
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-ink-soft">{next.reason}</p>
            <button
              onClick={() => openAssistant()}
              className="mt-4 flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-xs font-semibold text-surface-0 transition-colors hover:bg-jade-glow"
            >
              <Sparkles size={13} />
              Crear una tarea
            </button>
          </div>
        )}
      </section>

      <div className="metric mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line sm:grid-cols-4">
        <StatTile label="Vencidas" value={insights.overdue.length} tone={insights.overdue.length > 0 ? 'text-coral' : 'text-ink'} />
        <StatTile label="Vencen hoy" value={insights.dueToday.length} tone={insights.dueToday.length > 0 ? 'text-amber' : 'text-ink'} />
        <StatTile label="Cuellos de botella" value={insights.bottlenecks.length} tone={insights.bottlenecks.length > 0 ? 'text-amber' : 'text-ink'} />
        <StatTile label="Objetivos críticos" value={criticalObjectives} tone="text-ink" />
      </div>

      {insights.overdue.length > 0 && (
        <TaskGroup
          title="Vencidas"
          tone="coral"
          tasks={insights.overdue}
          onToggleDone={toggleDone}
        />
      )}

      {insights.dueToday.length > 0 && (
        <TaskGroup
          title="Vencen hoy"
          tone="amber"
          tasks={insights.dueToday}
          onToggleDone={toggleDone}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <WeekLoadChart data={insights.weekLoad} />

        <section className="panel p-5">
          <header className="mb-4 flex items-center gap-2">
            <Target size={14} className="text-ink-mute" />
            <h2 className="font-display text-base text-ink">Objetivos</h2>
          </header>

          {insights.objectiveProgress.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">Sin objetivos definidos.</p>
          ) : (
            <ul className="space-y-4">
              {insights.objectiveProgress.map((objective) => (
                <ObjectiveMeter key={objective.id} objective={objective} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {insights.bottlenecks.length > 0 && (
        <section className="panel mt-6 p-5">
          <header className="mb-4 flex items-center gap-2">
            <GitBranch size={14} className="text-amber" />
            <h2 className="font-display text-base text-ink">Están frenando el avance</h2>
          </header>

          <ul className="space-y-3">
            {insights.bottlenecks.map(({ task, blockingCount, blockedTaskTitles }) => (
              <li key={task.id} className="rounded-lg border border-line bg-surface-0 p-3.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-ink">{task.title}</p>
                  <span className="metric shrink-0 text-xs text-amber">
                    bloquea {blockingCount}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-ink-mute">
                  Esperan: {blockedTaskTitles.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.prioritySuggestions.length > 0 && (
        <section className="panel mt-6 p-5">
          <header className="mb-1 flex items-center gap-2">
            <AlertTriangle size={14} className="text-ink-mute" />
            <h2 className="font-display text-base text-ink">Revisa estas prioridades</h2>
          </header>
          <p className="mb-4 text-xs text-ink-mute">
            Tu prioridad y el puntaje del asistente se alejan dos niveles o más. Tú decides.
          </p>

          <ul className="divide-y divide-line">
            {insights.prioritySuggestions.map((change) => (
              <li key={change.taskId} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{change.taskTitle}</p>
                  <p className="mt-1 text-xs text-ink-soft">{change.reason}</p>
                  <p className="metric mt-1 text-[0.7rem] text-ink-mute">
                    ahora {PRIORITY_LABEL[change.currentPriority]} · sugerido{' '}
                    {PRIORITY_LABEL[change.suggestedPriority]}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateTask.mutate({ id: change.taskId, priority: change.suggestedPriority })
                  }
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-jade hover:text-jade"
                >
                  Aplicar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-surface-1 px-4 py-4">
      <p className="text-[0.65rem] uppercase tracking-wider text-ink-mute">{label}</p>
      <p className={`mt-1.5 text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function TaskGroup({
  title,
  tone,
  tasks,
  onToggleDone,
}: {
  title: string;
  tone: 'coral' | 'amber';
  tasks: TaskWithRelations[];
  onToggleDone: (task: TaskWithRelations) => void;
}) {
  return (
    <section className="panel mt-6 overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${tone === 'coral' ? 'bg-coral' : 'bg-amber'}`}
        />
        <h2 className="font-display text-base text-ink">{title}</h2>
        <span className="metric text-xs text-ink-mute">{tasks.length}</span>
      </header>

      <div className="divide-y divide-line">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggleDone={onToggleDone} />
        ))}
      </div>
    </section>
  );
}

/** Un valor unico no pide grafico: una barra con su cifra se lee mejor. */
function ObjectiveMeter({ objective }: { objective: ObjectiveProgress }) {
  const { progressPercentage: pct } = objective;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-ink">
          {objective.title}
          {objective.isCritical && (
            <span className="metric ml-2 rounded border border-coral/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-coral">
              crítico
            </span>
          )}
        </p>
        <span className="metric shrink-0 text-sm text-ink-soft">{pct}%</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-jade transition-all duration-500"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>

      <p className="metric mt-1.5 text-[0.65rem] text-ink-mute">
        {objective.goalType === 'completion'
          ? `${objective.completedTaskCount} de ${objective.linkedTaskCount} tareas`
          : objective.targetValue
            ? `${formatAmount(objective.currentValue, objective.unit)} de ${formatAmount(objective.targetValue, objective.unit)}`
            : 'sin meta definida'}
      </p>
    </li>
  );
}
