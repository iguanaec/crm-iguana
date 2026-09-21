import { useState } from 'react';
import type { DashboardInsights } from '@crm/types';
import { formatHours, parseCalendarDate } from '../../lib/format.js';

const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/**
 * Una sola serie (horas comprometidas por dia), asi que no lleva leyenda: el
 * titulo la nombra. La intensidad es un unico tono que crece con la magnitud.
 */
export function WeekLoadChart({ data }: { data: DashboardInsights['weekLoad'] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const peak = Math.max(...data.map((d) => d.estimatedHours), 1);
  const totalHours = data.reduce((sum, d) => sum + d.estimatedHours, 0);
  const totalTasks = data.reduce((sum, d) => sum + d.taskCount, 0);

  return (
    <section className="panel p-5">
      <header className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-base text-ink">Carga de los próximos 7 días</h2>
        <p className="metric text-xs text-ink-mute">
          {totalTasks} tarea(s) · {formatHours(totalHours)}
        </p>
      </header>

      {totalTasks === 0 ? (
        <p className="py-6 text-center text-sm text-ink-mute">
          Nada con fecha esta semana.
        </p>
      ) : (
        <div className="relative">
          {/* 2px de separacion entre barras y extremo de datos redondeado. */}
          <div className="flex h-32 items-end gap-[2px]">
            {data.map((day, index) => {
              const heightPercent = (day.estimatedHours / peak) * 100;
              const isEmpty = day.estimatedHours === 0;

              return (
                <button
                  key={day.date}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${day.date}: ${day.taskCount} tarea(s), ${formatHours(day.estimatedHours)}`}
                  className="group relative flex h-full flex-1 items-end"
                >
                  <span
                    className="w-full rounded-t-[4px] transition-all duration-200"
                    style={{
                      height: isEmpty ? '2px' : `${Math.max(heightPercent, 4)}%`,
                      backgroundColor: isEmpty
                        ? 'var(--color-surface-4)'
                        : 'var(--color-jade)',
                      // Un solo tono cuya intensidad sube con la carga del dia.
                      opacity: isEmpty ? 1 : 0.35 + (day.estimatedHours / peak) * 0.65,
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex gap-[2px] border-t border-line pt-2.5">
            {data.map((day, index) => (
              <span
                key={day.date}
                className={`metric flex-1 text-center text-[0.65rem] ${
                  index === 0 ? 'text-jade' : hovered === index ? 'text-ink' : 'text-ink-mute'
                }`}
              >
                {index === 0 ? 'HOY' : DAY_INITIALS[parseCalendarDate(day.date).getDay()]}
              </span>
            ))}
          </div>

          {hovered !== null && data[hovered] && (
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            >
              <span className="text-ink">{data[hovered]!.taskCount} tarea(s)</span>
              <span className="metric ml-2 text-ink-soft">
                {formatHours(data[hovered]!.estimatedHours)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
