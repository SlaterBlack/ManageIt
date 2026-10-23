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
  private readonly apiUrl = '/api/manageit/projects';

  list(): Observable<Project[]> {
    return this.http
      .get<{ projects: Project[] }>(this.apiUrl)
      .pipe(map(({ projects }) => projects));
  }

  create(projectCode: string, name: string, color: string): Observable<Project> {
    return this.http
      .post<{ project: Project }>(this.apiUrl, {
        projectCode,
        name,
        color,
      })
      .pipe(map(({ project }) => project));
  }

  update(id: string, changes: ProjectChanges): Observable<Project> {
    return this.http
      .patch<{ project: Project }>(`${this.apiUrl}/${id}`, changes)
      .pipe(map(({ project }) => project));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
