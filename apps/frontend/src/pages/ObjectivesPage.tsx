import { Loader2, Target } from 'lucide-react';
import { useObjectives } from '../lib/queries.js';
import { describeDueDate, formatAmount } from '../lib/format.js';

const GOAL_TYPE_LABEL: Record<string, string> = {
  revenue: 'Ingresos',
  completion: 'Avance',
  quality: 'Calidad',
  custom: 'Propio',
};

export function ObjectivesPage() {
  const { data: objectives, isLoading } = useObjectives();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-ink">Objetivos</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Las tareas ligadas a un objetivo crítico suben en el puntaje del asistente.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={20} className="animate-spin text-jade" />
        </div>
      ) : objectives?.length === 0 ? (
        <p className="panel mt-8 py-16 text-center text-sm text-ink-mute">
          Sin objetivos todavía.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {objectives?.map((objective) => {
            const end = describeDueDate(objective.endDate);
            const pct = objective.progressPercentage;

            return (
              <article key={objective.id} className="panel p-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Target
                        size={15}
                        className={objective.isCritical ? 'text-coral' : 'text-ink-mute'}
                      />
                      <h2 className="font-display text-lg text-ink">{objective.title}</h2>
                      {objective.isCritical && (
                        <span className="metric rounded border border-coral/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-coral">
                          crítico
                        </span>
                      )}
                    </div>

                    {objective.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {objective.description}
                      </p>
                    )}
                  </div>

                  <p className="metric shrink-0 text-3xl text-ink">{pct}%</p>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-jade transition-all duration-500"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>

                <div className="metric mt-3 flex flex-wrap items-center gap-3 text-[0.7rem] text-ink-mute">
                  <span>{GOAL_TYPE_LABEL[objective.goalType] ?? objective.goalType}</span>
                  <span>·</span>
                  <span>
                    {objective.goalType === 'completion'
                      ? `${objective.completedTaskCount} de ${objective.linkedTaskCount} tareas`
                      : objective.targetValue
                        ? `${formatAmount(objective.currentValue, objective.unit)} de ${formatAmount(objective.targetValue, objective.unit)}`
                        : 'sin meta'}
                  </span>
                  {objective.endDate && (
                    <>
                      <span>·</span>
                      <span>cierra {end.text}</span>
                    </>
                  )}
                  {objective.linkedTaskCount > 0 && objective.goalType !== 'completion' && (
                    <>
                      <span>·</span>
                      <span>{objective.linkedTaskCount} tarea(s) ligadas</span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
