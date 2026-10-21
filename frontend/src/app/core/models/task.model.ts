export type TaskStatus = 'not_started' | 'in_progress' | 'complete';

export interface Task {
  id: string;
  projectId: string;
  name: string;
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
  startDate: string;
  dueDate: string;
}

export interface TaskUpdate {
  progress?: number;
  status?: TaskStatus;
}
