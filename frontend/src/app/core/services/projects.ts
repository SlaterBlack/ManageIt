import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Project } from '../models/project.model';

type ProjectChanges = Partial<
  Pick<Project, 'projectCode' | 'name' | 'description' | 'color' | 'isArchived'>
>;

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Project[]> {
    return this.http
      .get<{ projects: Project[] }>('/api/projects')
      .pipe(map(({ projects }) => projects));
  }

  create(projectCode: string, name: string, color: string): Observable<Project> {
    return this.http
      .post<{ project: Project }>('/api/projects', {
        projectCode,
        name,
        color,
      })
      .pipe(map(({ project }) => project));
  }

  update(id: string, changes: ProjectChanges): Observable<Project> {
    return this.http
      .patch<{ project: Project }>(`/api/projects/${id}`, changes)
      .pipe(map(({ project }) => project));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/projects/${id}`);
  }
}
