import type {
  Client,
  Notification,
  Objective,
  Pipeline,
  PriorityFactors,
  Project,
  Task,
  TaskHistoryEntry,
} from '@crm/types';

/**
 * Las columnas DATE viajan como "2026-09-21", no como instante. Mandar el
 * datetime completo hace que un navegador en UTC-5 muestre el día anterior.
 */
export function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function instant(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: Client['status'];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    notes: row.notes,
    status: row.status,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: Project['status'];
  color: string;
  startDate: Date | null;
  endDate: Date | null;
  clientId: string | null;
  client?: { id: string; name: string; company: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    color: row.color,
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
    clientId: row.clientId,
    client: row.client ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type PipelineRow = {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  position: number;
};

export function toPipeline(row: PipelineRow): Pipeline {
  return row;
}

type TaskRow = {
  id: string;
  projectId: string;
  pipelineId: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: number;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  actualHours: number | null;
  assignedToId: string | null;
  createdById: string;
  parentTaskId: string | null;
  dependsOn: string[];
  objectiveId: string | null;
  labels: string[];
  position: number;
  aiPriorityScore: number | null;
  aiPriorityFactors: unknown;
  aiPriorityUpdatedAt: Date | null;
  generatedFromPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    pipelineId: row.pipelineId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority as Task['priority'],
    startDate: dateOnly(row.startDate),
    dueDate: dateOnly(row.dueDate),
    estimatedHours: row.estimatedHours,
    actualHours: row.actualHours,
    assignedToId: row.assignedToId,
    createdById: row.createdById,
    parentTaskId: row.parentTaskId,
    dependsOn: row.dependsOn,
    objectiveId: row.objectiveId,
    labels: row.labels,
    position: row.position,
    aiPriorityScore: row.aiPriorityScore,
    aiPriorityFactors: (row.aiPriorityFactors as PriorityFactors | null) ?? null,
    aiPriorityUpdatedAt: instant(row.aiPriorityUpdatedAt),
    generatedFromPrompt: row.generatedFromPrompt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: instant(row.completedAt),
  };
}

type ObjectiveRow = {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  goalType: Objective['goalType'];
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isCritical: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toObjective(row: ObjectiveRow): Objective {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    goalType: row.goalType,
    targetValue: row.targetValue,
    currentValue: row.currentValue,
    unit: row.unit,
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
    isCritical: row.isCritical,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type HistoryRow = {
  id: string;
  taskId: string;
  changedById: string | null;
  changeType: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

export function toHistoryEntry(row: HistoryRow): TaskHistoryEntry {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

type NotificationRow = {
  id: string;
  type: Notification['type'];
  title: string;
  message: string;
  taskId: string | null;
  projectId: string | null;
  isRead: boolean;
  readAt: Date | null;
  metadata: unknown;
  createdAt: Date;
};

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    taskId: row.taskId,
    projectId: row.projectId,
    isRead: row.isRead,
    readAt: instant(row.readAt),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Convierte "2026-09-21" en un Date a medianoche UTC para columnas DATE. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}
