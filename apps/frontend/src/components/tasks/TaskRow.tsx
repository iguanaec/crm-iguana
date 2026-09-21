import { Check, GitBranch, Clock } from 'lucide-react';
import type { TaskWithRelations } from '@crm/types';
import {
  DUE_TONE_CLASS,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  describeDueDate,
  formatHours,
  formatScore,
  scoreTone,
} from '../../lib/format.js';

interface TaskRowProps {
  task: TaskWithRelations;
  onToggleDone?: (task: TaskWithRelations) => void;
  onOpen?: (task: TaskWithRelations) => void;
  showProject?: boolean;
  showScore?: boolean;
  blockedCount?: number;
}

export function TaskRow({
  task,
  onToggleDone,
  onOpen,
  showProject = true,
  showScore = true,
  blockedCount,
}: TaskRowProps) {
  const due = describeDueDate(task.dueDate);
  const isDone = task.status === 'done';
  const priority = task.priority;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2">
      {onToggleDone && (
        <button
          onClick={() => onToggleDone(task)}
          aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como lista'}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ${
            isDone
              ? 'border-jade bg-jade text-surface-0'
              : 'border-line-strong text-transparent hover:border-jade hover:text-jade/40'
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>
      )}

      {/* La prioridad se lee por color y por texto: nunca solo por color. */}
      <span
        aria-hidden
        className={`h-7 w-[3px] shrink-0 rounded-full ${PRIORITY_COLOR[priority]}`}
      />

      <button
        onClick={() => onOpen?.(task)}
        className="min-w-0 flex-1 text-left"
        disabled={!onOpen}
      >
        <p
          className={`truncate text-sm ${isDone ? 'text-ink-mute line-through' : 'text-ink'}`}
        >
          {task.title}
        </p>

        <div className="mt-1 flex items-center gap-2.5 text-[0.7rem] text-ink-mute">
          {showProject && task.project && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: task.project.color }}
              />
              <span className="truncate">{task.project.name}</span>
            </span>
          )}

          <span className="metric">{PRIORITY_LABEL[priority]}</span>

          {task.estimatedHours !== null && (
            <span className="metric flex items-center gap-1">
              <Clock size={10} />
              {formatHours(task.estimatedHours)}
            </span>
          )}

          {blockedCount !== undefined && blockedCount > 0 && (
            <span className="metric flex items-center gap-1 text-amber">
              <GitBranch size={10} />
              bloquea {blockedCount}
            </span>
          )}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-4">
        <span className={`metric text-xs ${DUE_TONE_CLASS[due.tone]}`}>{due.text}</span>

        {showScore && (
          <span
            title="Puntaje del asistente (0 a 10)"
            className={`metric w-9 text-right text-sm ${scoreTone(task.aiPriorityScore)}`}
          >
            {formatScore(task.aiPriorityScore)}
          </span>
        )}
      </div>
    </div>
  );
}
