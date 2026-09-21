import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Client,
  DashboardInsights,
  ManualPriority,
  ObjectiveProgress,
  ParsedTaskDraft,
  Pipeline,
  PrioritizeResponse,
  Project,
  TaskHistoryEntry,
  TaskStatus,
  TaskWithRelations,
} from '@crm/types';
import { api } from './api.js';

export type ProjectSummary = Project & { taskCount: number };
export type PipelineWithCount = Pipeline & { taskCount: number };

interface TaskLink {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskDetail {
  task: TaskWithRelations;
  subtasks: TaskWithRelations[];
  history: TaskHistoryEntry[];
  blocking: TaskLink[];
  blockedBy: TaskLink[];
}

export const keys = {
  insights: ['insights'] as const,
  nextTask: ['next-task'] as const,
  clients: (search?: string) => ['clients', search ?? ''] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  pipelines: (projectId: string) => ['pipelines', projectId] as const,
  tasks: (filters: Record<string, string | undefined>) => ['tasks', filters] as const,
  task: (id: string) => ['task', id] as const,
  objectives: ['objectives'] as const,
};

function queryString(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useInsights() {
  return useQuery({
    queryKey: keys.insights,
    queryFn: () => api.get<DashboardInsights>('/ai/insights'),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => api.get<{ items: ProjectSummary[] }>('/projects').then((r) => r.items),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: keys.project(id ?? ''),
    enabled: Boolean(id),
    queryFn: () =>
      api.get<{ project: Project; pipelines: Pipeline[] }>(`/projects/${id}`),
  });
}

export function useTasks(filters: Record<string, string | undefined>) {
  return useQuery({
    queryKey: keys.tasks(filters),
    queryFn: () =>
      api
        .get<{ items: TaskWithRelations[] }>(`/tasks${queryString(filters)}`)
        .then((r) => r.items),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: keys.task(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => api.get<TaskDetail>(`/tasks/${id}`),
  });
}

export function useClients(search?: string) {
  return useQuery({
    queryKey: keys.clients(search),
    queryFn: () =>
      api.get<{ items: Client[] }>(`/clients${queryString({ search })}`).then((r) => r.items),
  });
}

export function useObjectives() {
  return useQuery({
    queryKey: keys.objectives,
    queryFn: () =>
      api.get<{ items: ObjectiveProgress[] }>('/objectives').then((r) => r.items),
  });
}

/** Todo lo que toca tareas invalida el resumen: el asistente recalcula con cada cambio. */
function useTaskInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['tasks'] });
    void client.invalidateQueries({ queryKey: keys.insights });
    void client.invalidateQueries({ queryKey: keys.nextTask });
    void client.invalidateQueries({ queryKey: keys.objectives });
  };
}

export interface CreateTaskInput {
  projectId: string;
  pipelineId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: ManualPriority;
  estimatedHours?: number | null;
  objectiveId?: string | null;
  assignedToId?: string | null;
  generatedFromPrompt?: string | null;
}

export function useCreateTask() {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api.post<{ task: TaskWithRelations }>('/tasks', input).then((r) => r.task),
    onSuccess: invalidate,
  });
}

export interface UpdateTaskInput {
  id: string;
  status?: TaskStatus;
  priority?: ManualPriority;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  dependsOn?: string[];
  objectiveId?: string | null;
}

export function useUpdateTask() {
  const invalidate = useTaskInvalidation();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTaskInput) =>
      api.patch<{ task: TaskWithRelations }>(`/tasks/${id}`, patch).then((r) => r.task),
    onSuccess: (task) => {
      invalidate();
      void client.invalidateQueries({ queryKey: keys.task(task.id) });
    },
  });
}

export function useMoveTask() {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      pipelineId,
      position,
    }: {
      id: string;
      pipelineId: string;
      position: number;
    }) =>
      api
        .patch<{ task: TaskWithRelations }>(`/tasks/${id}/move`, { pipelineId, position })
        .then((r) => r.task),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/tasks/${id}`),
    onSuccess: invalidate,
  });
}

export function useParseTask() {
  return useMutation({
    mutationFn: (text: string) =>
      api.post<{ draft: ParsedTaskDraft; problems: Array<{ field: string; message: string }> }>(
        '/ai/parse-task',
        { text },
      ),
  });
}

export function usePrioritize() {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: (projectId?: string) =>
      api.post<PrioritizeResponse>('/ai/prioritize', projectId ? { projectId } : {}),
    onSuccess: invalidate,
  });
}

export function useCreateClient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; company?: string | null; email?: string | null; phone?: string | null }) =>
      api.post<{ client: Client }>('/clients', input).then((r) => r.client),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      color?: string;
      clientId?: string | null;
      description?: string | null;
      endDate?: string | null;
    }) => api.post<{ project: Project }>('/projects', input).then((r) => r.project),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.projects }),
  });
}
