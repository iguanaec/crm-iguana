export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CLIENT_STATUSES = ['active', 'inactive', 'archived'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const OBJECTIVE_TYPES = ['revenue', 'completion', 'quality', 'custom'] as const;
export type ObjectiveType = (typeof OBJECTIVE_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'daily_digest',
  'deadline_approaching',
  'priority_changed',
  'task_assigned',
  'bottleneck_detected',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const INTEGRATION_PLATFORMS = ['discord', 'slack'] as const;
export type IntegrationPlatform = (typeof INTEGRATION_PLATFORMS)[number];

/** 1 = backlog, 5 = urgente. Lo fija la persona; el asistente solo sugiere cambios. */
export type ManualPriority = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  digestHour: number;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: ClientStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  startDate: string | null;
  endDate: string | null;
  clientId: string | null;
  client?: Pick<Client, 'id' | 'name' | 'company'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  position: number;
}

export interface Task {
  id: string;
  projectId: string;
  pipelineId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: ManualPriority;
  startDate: string | null;
  dueDate: string | null;
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
  aiPriorityFactors: PriorityFactors | null;
  aiPriorityUpdatedAt: string | null;
  generatedFromPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskWithRelations extends Task {
  project?: Pick<Project, 'id' | 'name' | 'color'>;
  assignedTo?: Pick<User, 'id' | 'name'> | null;
  subtasks?: Task[];
}

export interface Objective {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  goalType: ObjectiveType;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  startDate: string | null;
  endDate: string | null;
  isCritical: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveProgress extends Objective {
  progressPercentage: number;
  linkedTaskCount: number;
  completedTaskCount: number;
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  changedById: string | null;
  changeType: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId: string | null;
  projectId: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface IntegrationConfig {
  id: string;
  platform: IntegrationPlatform;
  /** Nunca se devuelve completa al cliente: se enmascara. */
  webhookUrlMasked: string;
  isActive: boolean;
  notificationTypes: NotificationType[];
  lastDeliveryAt: string | null;
  lastDeliveryOk: boolean | null;
  createdAt: string;
}

/** Los cuatro factores del motor de priorización, cada uno normalizado a 0-1. */
export interface PriorityFactors {
  urgency: number;
  dependencies: number;
  impact: number;
  workload: number;
}

export interface PriorityResult {
  taskId: string;
  score: number;
  factors: PriorityFactors;
  reason: string;
}

export interface PriorityChange extends PriorityResult {
  previousScore: number | null;
  suggestedPriority: ManualPriority;
  currentPriority: ManualPriority;
}

export interface PrioritizeResponse {
  tasksEvaluated: number;
  changes: PriorityChange[];
  calculatedAt: string;
}

export interface NextTaskSuggestion {
  task: TaskWithRelations | null;
  reason: string;
  confidence: number;
  alternatives: Array<{ task: TaskWithRelations; reason: string }>;
}

export interface Bottleneck {
  task: TaskWithRelations;
  blockingCount: number;
  blockedTaskTitles: string[];
}

export interface DashboardInsights {
  nextTask: NextTaskSuggestion;
  dueToday: TaskWithRelations[];
  overdue: TaskWithRelations[];
  bottlenecks: Bottleneck[];
  prioritySuggestions: PriorityChange[];
  weekLoad: Array<{ date: string; taskCount: number; estimatedHours: number }>;
  objectiveProgress: ObjectiveProgress[];
}

/** Resultado del parser de lenguaje natural. Nada de esto se guarda sin confirmación. */
export interface ParsedTaskDraft {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: ManualPriority;
  estimatedHours: number | null;
  assigneeName: string | null;
  assigneeId: string | null;
  subtasks: string[];
  confidence: number;
  matched: {
    date: string | null;
    priority: string | null;
    duration: string | null;
    assignee: string | null;
  };
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
