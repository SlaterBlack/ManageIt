import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { ProjectsService } from '../../core/services/projects';
import { ProjectColorPicker } from './project-color-picker';

const DEFAULT_PROJECT_COLOR = '#D87535';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule, ProjectColorPicker],
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
  readonly newProjectColor = signal(DEFAULT_PROJECT_COLOR);
  readonly editingProjectId = signal<string | null>(null);
  readonly isSavingProject = signal(false);
  readonly updatingColorIds = signal<ReadonlySet<string>>(new Set());
  readonly updatingProjectIds = signal<ReadonlySet<string>>(new Set());
  readonly openProjectMenuId = signal<string | null>(null);
  readonly archivedView = signal(false);
  readonly visibleProjects = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.projects().filter(
      (project) =>
        project.isArchived === this.archivedView() &&
        `${project.projectCode} ${project.name} ${project.description}`
          .toLocaleLowerCase()
          .includes(query),
    );
  });

  projectCode = '';
  projectName = '';
  editedProjectCode = '';
  editedProjectName = '';

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
    if (!this.showProjectForm()) {
      this.errorMessage.set('');
    }
  }

  openProjectForm(): void {
    this.showProjectForm.set(true);
  }

  canCreateProject(): boolean {
    return (
      /^\d{3}$/.test(this.projectCode.trim()) &&
      Boolean(this.projectName.trim()) &&
      !this.isCreating()
    );
  }

  createProject(): void {
    const projectCode = this.projectCode.trim();
    const name = this.projectName.trim();
    if (!/^\d{3}$/.test(projectCode)) {
      this.errorMessage.set('Enter a three-digit project code.');
      return;
    }
    if (!name || this.isCreating()) {
      return;
    }

    this.isCreating.set(true);
    this.projectsApi
      .create(projectCode, name, this.newProjectColor())
      .subscribe({
        next: (project) => {
          this.projects.update((projects) => [...projects, project]);
          this.projectCode = '';
          this.projectName = '';
          this.newProjectColor.set(DEFAULT_PROJECT_COLOR);
          this.showProjectForm.set(false);
          this.errorMessage.set('');
          this.isCreating.set(false);
        },
        error: (error: unknown) => {
          this.isCreating.set(false);
          this.errorMessage.set(
            this.apiError(error, 'Could not create project. Please try again.'),
          );
        },
      });
  }

  startEditingProject(project: Project): void {
    this.errorMessage.set('');
    this.openProjectMenuId.set(null);
    this.editingProjectId.set(project.id);
    this.editedProjectCode = project.projectCode;
    this.editedProjectName = project.name;
  }

  cancelEditingProject(): void {
    this.editingProjectId.set(null);
  }

  canSaveProjectDetails(): boolean {
    return (
      /^\d{3}$/.test(this.editedProjectCode.trim()) &&
      Boolean(this.editedProjectName.trim()) &&
      !this.isSavingProject()
    );
  }

  saveProjectDetails(): void {
    const projectId = this.editingProjectId();
    const projectCode = this.editedProjectCode.trim();
    const name = this.editedProjectName.trim();
    if (!projectId) {
      return;
    }
    if (!/^\d{3}$/.test(projectCode)) {
      this.errorMessage.set('Enter a three-digit project code.');
      return;
    }
    if (!name) {
      this.errorMessage.set('Enter a project name.');
      return;
    }

    this.isSavingProject.set(true);
    this.projectsApi
      .update(projectId, { projectCode, name })
      .pipe(finalize(() => this.isSavingProject.set(false)))
      .subscribe({
        next: (updatedProject) => {
          this.projects.update((projects) =>
            projects.map((project) =>
              project.id === projectId ? updatedProject : project,
            ),
          );
          this.editingProjectId.set(null);
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.apiError(error, 'Could not update project details. Please try again.'),
          );
        },
      });
  }

  isUpdatingColor(projectId: string): boolean {
    return this.updatingColorIds().has(projectId);
  }

  updateProjectColor(projectId: string, color: string): void {
    const project = this.projects().find((item) => item.id === projectId);
    if (!project || project.color.toUpperCase() === color.toUpperCase() || this.isUpdatingColor(projectId)) {
      return;
    }

    this.updatingColorIds.update((ids) => new Set(ids).add(projectId));
    this.projectsApi
      .update(projectId, { color })
      .pipe(
        finalize(() =>
          this.updatingColorIds.update((ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(projectId);
            return nextIds;
          }),
        ),
      )
      .subscribe({
        next: (updatedProject) => {
          this.projects.update((projects) =>
            projects.map((item) =>
              item.id === projectId ? { ...item, color: updatedProject.color } : item,
            ),
          );
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.apiError(error, 'Could not update the project color. Please try again.'),
          );
        },
      });
  }

  toggleProjectMenu(projectId: string): void {
    this.openProjectMenuId.update((current) =>
      current === projectId ? null : projectId,
    );
  }

  archiveProject(project: Project): void {
    this.setProjectArchived(project, true);
  }

  restoreProject(project: Project): void {
    this.setProjectArchived(project, false);
  }

  deleteProject(project: Project): void {
    if (
      !window.confirm(
        `Permanently delete "${project.name}" and all of its tasks and dependencies? This cannot be undone.`,
      )
    ) {
      this.openProjectMenuId.set(null);
      return;
    }

    this.openProjectMenuId.set(null);
    this.updatingProjectIds.update(
      (ids) => new Set(ids).add(project.id),
    );
    this.projectsApi
      .delete(project.id)
      .pipe(
        finalize(() =>
          this.updatingProjectIds.update((ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(project.id);
            return nextIds;
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.projects.update((projects) =>
            projects.filter((item) => item.id !== project.id),
          );
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.apiError(error, 'Could not delete the project. Please try again.'),
          );
        },
      });
  }

  isUpdatingProject(projectId: string): boolean {
    return this.updatingProjectIds().has(projectId);
  }

  @HostListener('document:click', ['$event'])
  closeProjectMenuOnOutsideClick(event: MouseEvent): void {
    if (
      event.target instanceof Element &&
      !event.target.closest('.project-menu')
    ) {
      this.openProjectMenuId.set(null);
    }
  }

  openCalendar(project: Project): void {
    void this.router.navigate(['/calendar'], {
      queryParams: { project: project.id },
    });
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

  private setProjectArchived(project: Project, isArchived: boolean): void {
    if (this.isUpdatingProject(project.id)) {
      return;
    }
    this.openProjectMenuId.set(null);
    this.updatingProjectIds.update(
      (ids) => new Set(ids).add(project.id),
    );
    this.projectsApi
      .update(project.id, { isArchived })
      .pipe(
        finalize(() =>
          this.updatingProjectIds.update((ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(project.id);
            return nextIds;
          }),
        ),
      )
      .subscribe({
        next: (updatedProject) => {
          this.projects.update((projects) =>
            projects.map((item) =>
              item.id === project.id ? updatedProject : item,
            ),
          );
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.apiError(
              error,
              `Could not ${isArchived ? 'archive' : 'restore'} the project. Please try again.`,
            ),
          );
        },
      });
  }
}
