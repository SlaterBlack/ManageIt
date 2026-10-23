import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CreateTaskRequest,
  Task,
  TaskUpdate,
} from '../models/task.model';
import { TaskDependency } from '../models/task-dependency.model';

@Injectable({
  providedIn: 'root',
})
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/manageit';

  list(projectId: string): Observable<Task[]> {
    return this.http
      .get<{ tasks: Task[] }>(`${this.apiUrl}/projects/${projectId}/tasks`)
      .pipe(map(({ tasks }) => tasks));
  }

  create(projectId: string, request: CreateTaskRequest): Observable<Task> {
    return this.http
      .post<{ task: Task }>(`${this.apiUrl}/projects/${projectId}/tasks`, request)
      .pipe(map(({ task }) => task));
  }

  update(taskId: string, update: TaskUpdate): Observable<Task> {
    return this.http
      .patch<{ task: Task }>(`${this.apiUrl}/tasks/${taskId}`, update)
      .pipe(map(({ task }) => task));
  }

  delete(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${taskId}`);
  }

  listDependencies(projectId: string): Observable<TaskDependency[]> {
    return this.http
      .get<{ dependencies: TaskDependency[] }>(
        `${this.apiUrl}/projects/${projectId}/dependencies`,
      )
      .pipe(map(({ dependencies }) => dependencies));
  }

  createDependency(
    projectId: string,
    predecessorTaskId: string,
    successorTaskId: string,
  ): Observable<TaskDependency> {
    return this.http
      .post<{ dependency: TaskDependency }>(
        `${this.apiUrl}/projects/${projectId}/dependencies`,
        { predecessorTaskId, successorTaskId },
      )
      .pipe(map(({ dependency }) => dependency));
  }

  deleteDependency(projectId: string, dependencyId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/projects/${projectId}/dependencies/${dependencyId}`,
    );
  }
}
