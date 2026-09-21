import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GitBranch, Loader2, Plus } from 'lucide-react';
import type { TaskWithRelations } from '@crm/types';
import { useMoveTask, useProject, useTasks } from '../lib/queries.js';
import { useAssistantPanel } from '../components/assistant/assistantPanel.js';
import {
  DUE_TONE_CLASS,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  describeDueDate,
  formatScore,
  scoreTone,
  tasksWord,
} from '../lib/format.js';

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: detail, isLoading } = useProject(projectId);
  const { data: tasks } = useTasks({ projectId });
  const moveTask = useMoveTask();
  const openAssistant = useAssistantPanel((s) => s.open);

  // Copia local para que la tarjeta se quede donde se suelta, sin esperar al servidor.
  const [board, setBoard] = useState<TaskWithRelations[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (tasks) setBoard(tasks);
  }, [tasks]);

  const sensors = useSensors(
    // Un umbral evita que un clic normal se interprete como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byPipeline = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const pipeline of detail?.pipelines ?? []) map.set(pipeline.id, []);
    for (const task of board) {
      const list = map.get(task.pipelineId);
      if (list) list.push(task);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [board, detail?.pipelines]);

  const blockedCountByTask = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of board) {
      if (task.status === 'done') continue;
      for (const blockerId of task.dependsOn) {
        counts.set(blockerId, (counts.get(blockerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [board]);

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = board.find((t) => t.id === taskId);
    if (!task) return;

    const overId = String(over.id);
    const overTask = board.find((t) => t.id === overId);
    // Se suelta sobre otra tarjeta o sobre la columna vacia.
    const targetPipelineId = overTask?.pipelineId ?? overId;
    if (!detail?.pipelines.some((p) => p.id === targetPipelineId)) return;

    const destination = (byPipeline.get(targetPipelineId) ?? []).filter((t) => t.id !== taskId);
    const index = overTask ? destination.findIndex((t) => t.id === overId) : destination.length;
    const position = index === -1 ? destination.length : index;

    if (task.pipelineId === targetPipelineId && task.position === position) return;

    destination.splice(position, 0, { ...task, pipelineId: targetPipelineId });
    const repositioned = destination.map((t, i) => ({ ...t, position: i }));

    setBoard((previous) => [
      ...previous.filter((t) => t.pipelineId !== targetPipelineId && t.id !== taskId),
      ...repositioned,
    ]);

    moveTask.mutate({ id: taskId, pipelineId: targetPipelineId, position });
  }

  if (isLoading || !detail) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={20} className="animate-spin text-jade" />
      </div>
    );
  }

  const dragging = board.find((t) => t.id === draggingId);

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b border-line px-8 py-6">
        <Link
          to="/proyectos"
          className="metric mb-3 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wider text-ink-mute transition-colors hover:text-ink-soft"
        >
          <ArrowLeft size={12} />
          Proyectos
        </Link>

        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-7 w-1.5 rounded-full"
              style={{ backgroundColor: detail.project.color }}
            />
            <div>
              <h1 className="font-display text-3xl tracking-tight text-ink">
                {detail.project.name}
              </h1>
              {detail.project.client && (
                <p className="mt-0.5 text-xs text-ink-mute">
                  {detail.project.client.company ?? detail.project.client.name}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => openAssistant(projectId)}
            className="flex items-center gap-2 rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow"
          >
            <Plus size={15} />
            Nueva tarea
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto px-8 py-6">
          {detail.pipelines.map((pipeline) => (
            <Column
              key={pipeline.id}
              id={pipeline.id}
              name={pipeline.name}
              color={pipeline.color}
              tasks={byPipeline.get(pipeline.id) ?? []}
              blockedCounts={blockedCountByTask}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging && <Card task={dragging} blockedCount={blockedCountByTask.get(dragging.id)} isOverlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  id,
  name,
  color,
  tasks,
  blockedCounts,
}: {
  id: string;
  name: string;
  color: string | null;
  tasks: TaskWithRelations[];
  blockedCounts: Map<string, number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const hours = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);

  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="mb-3 flex items-center gap-2 px-1">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color ?? 'var(--color-ink-mute)' }}
        />
        <h2 className="text-sm font-medium text-ink">{name}</h2>
        <span className="metric text-xs text-ink-mute">{tasks.length}</span>
        {hours > 0 && <span className="metric ml-auto text-[0.65rem] text-ink-mute">{hours} h</span>}
      </header>

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded-card border border-dashed p-2 transition-colors duration-150 ${
          isOver ? 'border-jade/50 bg-jade/[0.04]' : 'border-line bg-surface-1/40'
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} blockedCount={blockedCounts.get(task.id)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-ink-mute">Arrastra una tarea aquí</p>
        )}
      </div>
    </section>
  );
}

function SortableCard({ task, blockedCount }: { task: TaskWithRelations; blockedCount?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-30' : ''}
    >
      <Card task={task} blockedCount={blockedCount} />
    </div>
  );
}

function Card({
  task,
  blockedCount,
  isOverlay,
}: {
  task: TaskWithRelations;
  blockedCount?: number;
  isOverlay?: boolean;
}) {
  const due = describeDueDate(task.dueDate);

  return (
    <article
      className={`rounded-lg border bg-surface-1 p-3 ${
        isOverlay ? 'border-jade/50 shadow-xl' : 'border-line hover:border-line-strong'
      } transition-colors duration-150`}
    >
      <div className="flex gap-2.5">
        <span
          aria-hidden
          className={`w-[3px] shrink-0 rounded-full ${PRIORITY_COLOR[task.priority]}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${task.status === 'done' ? 'text-ink-mute line-through' : 'text-ink'}`}>
            {task.title}
          </p>

          <div className="metric mt-2.5 flex items-center gap-2 text-[0.65rem]">
            <span className="text-ink-mute">{PRIORITY_LABEL[task.priority]}</span>
            {task.dueDate && (
              <>
                <span className="text-ink-mute">·</span>
                <span className={DUE_TONE_CLASS[due.tone]}>{due.text}</span>
              </>
            )}
            <span className={`ml-auto ${scoreTone(task.aiPriorityScore)}`}>
              {formatScore(task.aiPriorityScore)}
            </span>
          </div>

          {blockedCount !== undefined && blockedCount > 0 && (
            <p className="metric mt-2 flex items-center gap-1 text-[0.65rem] text-amber">
              <GitBranch size={10} />
              bloquea {tasksWord(blockedCount)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
