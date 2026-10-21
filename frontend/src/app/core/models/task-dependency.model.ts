export interface TaskDependency {
  id: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  createdAt: string;
  updatedAt: string;
}
