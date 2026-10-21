import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CreateTaskRequest,
  Task,
  TaskUpdate,
} from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class TasksService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<Task[]> {
    return this.http
      .get<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks`)
      .pipe(map(({ tasks }) => tasks));
  }

  create(projectId: string, request: CreateTaskRequest): Observable<Task> {
    return this.http
      .post<{ task: Task }>(`/api/projects/${projectId}/tasks`, request)
      .pipe(map(({ task }) => task));
  }

  update(taskId: string, update: TaskUpdate): Observable<Task> {
    return this.http
      .patch<{ task: Task }>(`/api/tasks/${taskId}`, update)
      .pipe(map(({ task }) => task));
  }
}
