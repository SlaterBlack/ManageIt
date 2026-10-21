import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Project } from '../models/project.model';

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

  create(name: string): Observable<Project> {
    return this.http
      .post<{ project: Project }>('/api/projects', { name })
      .pipe(map(({ project }) => project));
  }
}
