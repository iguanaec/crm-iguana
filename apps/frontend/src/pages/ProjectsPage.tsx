import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, X } from 'lucide-react';
import { useClients, useCreateProject, useProjects } from '../lib/queries.js';
import { PROJECT_COLORS, describeDueDate } from '../lib/format.js';

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Terminado',
  archived: 'Archivado',
};

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const [isCreating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink">Proyectos</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {projects?.length ?? 0} en total
          </p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow"
        >
          <Plus size={15} />
          Nuevo proyecto
        </button>
      </header>

      {isCreating && (
        <NewProjectForm onClose={() => setCreating(false)} projectCount={projects?.length ?? 0} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={20} className="animate-spin text-jade" />
        </div>
      ) : projects?.length === 0 ? (
        <p className="panel mt-8 py-16 text-center text-sm text-ink-mute">
          Todavía no hay proyectos. Crea el primero para empezar a organizar tareas.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {projects?.map((project) => {
            const end = describeDueDate(project.endDate);

            return (
              <Link
                key={project.id}
                to={`/proyectos/${project.id}`}
                className="panel group block p-5 transition-colors duration-150 hover:border-line-strong"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-lg text-ink">{project.name}</h2>
                    {project.client && (
                      <p className="mt-0.5 truncate text-xs text-ink-mute">
                        {project.client.company ?? project.client.name}
                      </p>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                    {project.description}
                  </p>
                )}

                <div className="metric mt-4 flex items-center gap-3 border-t border-line pt-3 text-[0.7rem] text-ink-mute">
                  <span>{project.taskCount} tarea(s)</span>
                  <span>·</span>
                  <span>{PROJECT_STATUS_LABEL[project.status] ?? project.status}</span>
                  {project.endDate && (
                    <>
                      <span>·</span>
                      <span>entrega {end.text}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onClose, projectCount }: { onClose: () => void; projectCount: number }) {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data: clients } = useClients();
  const createProject = useCreateProject();

  // Rotacion por orden de creacion: dos proyectos seguidos nunca comparten color.
  const color = PROJECT_COLORS[projectCount % PROJECT_COLORS.length]!;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createProject.mutate(
          {
            name,
            color,
            clientId: clientId || null,
            endDate: endDate || null,
          },
          { onSuccess: onClose },
        );
      }}
      className="panel reveal mt-6 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="metric text-xs uppercase tracking-wider text-ink-soft">Nuevo proyecto</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1 text-ink-mute hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del proyecto"
          required
          minLength={2}
          className="rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-mute focus:border-jade focus:outline-none sm:col-span-2"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink focus:border-jade focus:outline-none"
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink focus:border-jade focus:outline-none sm:col-span-2"
        >
          <option value="">Sin cliente</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company ?? client.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={createProject.isPending || name.trim().length < 2}
          className="flex items-center justify-center gap-2 rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow disabled:opacity-40"
        >
          {createProject.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Crear'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-mute">
        Se crean cuatro columnas por defecto: por hacer, en curso, revisión y listo.
      </p>
    </form>
  );
}
