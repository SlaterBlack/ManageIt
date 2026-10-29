export type TaskStatus = 'not_started' | 'in_progress' | 'complete';

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  isMilestone: boolean;
  isArchived: boolean;
  name: string;
  color: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  name: string;
  assignee: string;
  isMilestone?: boolean;
  parentTaskId?: string | null;
  startDate: string;
  dueDate: string;
}

export interface TaskUpdate {
  name?: string;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  progress?: number;
  status?: TaskStatus;
  isMilestone?: boolean;
  isArchived?: boolean;
  color?: string;
}
