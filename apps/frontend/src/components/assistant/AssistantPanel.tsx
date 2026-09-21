import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Flag,
  Loader2,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ParsedTaskDraft } from '@crm/types';
import { useAssistantPanel } from './assistantPanel.js';
import { useCreateTask, useParseTask, useProject, useProjects } from '../../lib/queries.js';
import { PRIORITY_LABEL, describeDueDate, formatHours } from '../../lib/format.js';

const EXAMPLES = [
  'Llamar a Laura para revisar la propuesta el martes, urgente',
  'Preparar informe de cierre en 3 horas',
  'Lanzar landing con: copy, diseño y pruebas',
];

export function AssistantPanel() {
  const isOpen = useAssistantPanel((s) => s.isOpen);
  const close = useAssistantPanel((s) => s.close);
  const presetProjectId = useAssistantPanel((s) => s.presetProjectId);

  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [draft, setDraft] = useState<ParsedTaskDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: projects } = useProjects();
  const { data: projectDetail } = useProject(projectId || undefined);
  const parse = useParseTask();
  const createTask = useCreateTask();

  // Al abrir: limpiar, enfocar y preseleccionar el proyecto del contexto.
  useEffect(() => {
    if (!isOpen) return;
    setText('');
    setDraft(null);
    setError(null);
    setProjectId(presetProjectId ?? projects?.[0]?.id ?? '');
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen, presetProjectId, projects]);

  useEffect(() => {
    const first = projectDetail?.pipelines[0];
    if (first) setPipelineId(first.id);
  }, [projectDetail]);

  // El borrador se recalcula al dejar de escribir: leer es barato y local.
  useEffect(() => {
    if (!isOpen || text.trim().length < 3) {
      setDraft(null);
      return;
    }
    const timer = setTimeout(() => {
      parse.mutate(text, {
        onSuccess: (result) => setDraft(result.draft),
        onError: () => setDraft(null),
      });
    }, 350);
    return () => clearTimeout(timer);
    // `parse` es estable entre renders; incluirlo dispararia el efecto en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const canSubmit = Boolean(draft && draft.title.length >= 3 && projectId && pipelineId);

  async function submit() {
    if (!draft || !canSubmit) return;
    setError(null);

    try {
      await createTask.mutateAsync({
        projectId,
        pipelineId,
        title: draft.title,
        dueDate: draft.dueDate,
        priority: draft.priority,
        estimatedHours: draft.estimatedHours,
        generatedFromPrompt: text.trim(),
      });

      // Las subtareas se crean despues, colgadas de la misma columna.
      for (const subtask of draft.subtasks) {
        await createTask.mutateAsync({ projectId, pipelineId, title: subtask });
      }

      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea');
    }
  }

  const due = draft ? describeDueDate(draft.dueDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-4 pt-[8vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-label="Crear tarea escribiendo"
        className="panel-assistant reveal w-full max-w-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-jade" />
            <h2 className="metric text-xs uppercase tracking-[0.2em] text-jade">
              Describe la tarea
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-ink-mute transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Escribe como hablas: «llamar a Laura el martes, urgente»"
            className="w-full resize-none rounded-lg border border-line bg-surface-0 px-4 py-3.5 text-base leading-relaxed text-ink placeholder:text-ink-mute focus:border-jade focus:outline-none"
          />

          {!text && (
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setText(example)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-mute transition-colors hover:border-line-strong hover:text-ink-soft"
                >
                  {example}
                </button>
              ))}
            </div>
          )}

          {/* Lo que el asistente entendio, antes de guardar nada. */}
          {draft && (
            <div className="reveal mt-5 rounded-lg border border-line bg-surface-0 p-4">
              <p className="metric mb-3 text-[0.65rem] uppercase tracking-wider text-ink-mute">
                Entendí esto
              </p>

              <p className="text-base font-medium text-ink">{draft.title}</p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <Chip icon={CalendarClock} active={Boolean(draft.dueDate)}>
                  {due?.text ?? 'sin fecha'}
                </Chip>
                <Chip icon={Flag} active={Boolean(draft.matched.priority)}>
                  {PRIORITY_LABEL[draft.priority]}
                </Chip>
                {draft.estimatedHours !== null && (
                  <Chip icon={Clock} active>
                    {formatHours(draft.estimatedHours)}
                  </Chip>
                )}
                {draft.assigneeName && <Chip active>{draft.assigneeName}</Chip>}
              </div>

              {draft.subtasks.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
                  {draft.subtasks.map((subtask) => (
                    <li key={subtask} className="flex items-center gap-2 text-sm text-ink-soft">
                      <span className="h-1 w-1 rounded-full bg-jade" />
                      {subtask}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {parse.isPending && !draft && (
            <p className="metric mt-4 flex items-center gap-2 text-xs text-ink-mute">
              <Loader2 size={12} className="animate-spin" /> leyendo…
            </p>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="metric mb-1.5 block text-[0.65rem] uppercase tracking-wider text-ink-soft">
                Proyecto
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={selectClass}
              >
                {projects?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="metric mb-1.5 block text-[0.65rem] uppercase tracking-wider text-ink-soft">
                Columna
              </span>
              <select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                className={selectClass}
              >
                {projectDetail?.pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-3.5 py-2.5 text-sm text-coral">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={close}
              className="rounded-lg px-4 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              Cancelar
            </button>
            <button
              onClick={() => void submit()}
              disabled={!canSubmit || createTask.isPending}
              className="flex items-center gap-2 rounded-lg bg-jade px-5 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow disabled:opacity-40"
            >
              {createTask.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Crear {draft && draft.subtasks.length > 0 ? `y ${draft.subtasks.length} subtareas` : 'tarea'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const selectClass =
  'w-full rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink focus:border-jade focus:outline-none';

function Chip({
  icon: Icon,
  active,
  children,
}: {
  icon?: LucideIcon;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        active ? 'border-jade/35 bg-jade/10 text-jade' : 'border-line text-ink-mute'
      }`}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
