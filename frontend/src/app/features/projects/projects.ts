import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Project } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private readonly projectsApi = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly showProjectForm = signal(false);
  readonly isCreating = signal(false);
  readonly searchTerm = signal('');
  readonly visibleProjects = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.projects().filter((project) =>
      `${project.name} ${project.description}`.toLocaleLowerCase().includes(query),
    );
  });

  projectName = '';

  constructor() {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.projectsApi.list().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(
          this.apiError(
            error,
            'Could not load projects. Check that the API and database are running.',
          ),
        );
      },
    });
  }

  toggleProjectForm(): void {
    this.showProjectForm.update((visible) => !visible);
  }

  createProject(): void {
    const name = this.projectName.trim();
    if (!name || this.isCreating()) return;

    this.isCreating.set(true);
    this.projectsApi.create(name).subscribe({
      next: (project) => {
        this.projects.update((projects) => [...projects, project]);
        this.projectName = '';
        this.showProjectForm.set(false);
        this.isCreating.set(false);
        this.errorMessage.set('');
      },
      error: (error: unknown) => {
        this.isCreating.set(false);
        this.errorMessage.set(
          this.apiError(error, 'Could not create project. Please try again.'),
        );
      },
    });
  }

  openCalendar(project: Project): void {
    void this.router.navigate(['/calendar'], {
      queryParams: { project: project.id },
    });
  }

  projectColor(name: string): string {
    const colors = ['#d87535', '#ba9a62', '#65866b', '#c6913e'];
    return colors[name.length % colors.length];
  }

  trackProject(_index: number, project: Project): string {
    return project.id;
  }

  private apiError(error: unknown, fallback: string): string {
    if (
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'error' in error.error &&
      typeof error.error.error === 'string'
    ) {
      return error.error.error;
    }
    return fallback;
  }
}
