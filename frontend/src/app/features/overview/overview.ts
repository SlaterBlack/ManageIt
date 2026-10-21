import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap, map } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { Task } from '../../core/models/task.model';
import { ProjectsService } from '../../core/services/projects';
import { TasksService } from '../../core/services/tasks';

interface ProjectSummary {
  project: Project;
  tasks: Task[];
  completedCount: number;
  progress: number;
}

type OverviewTask = Task & { projectName: string };

@Component({
  selector: 'app-overview',
  imports: [CommonModule, RouterLink],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  private readonly projectsApi = inject(ProjectsService);
  private readonly tasksApi = inject(TasksService);

  readonly summaries = signal<ProjectSummary[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly allTasks = computed<OverviewTask[]>(() =>
    this.summaries().flatMap(({ project, tasks }) =>
      tasks.map((task) => ({ ...task, projectName: project.name })),
    ),
  );
  readonly projectCount = computed(() => this.summaries().length);
  readonly taskCount = computed(() => this.allTasks().length);
  readonly completedCount = computed(
    () => this.allTasks().filter((task) => task.status === 'complete').length,
  );
  readonly inProgressCount = computed(
    () => this.allTasks().filter((task) => task.status === 'in_progress').length,
  );
  readonly overallProgress = computed(() =>
    this.taskCount()
      ? Math.round(
          this.allTasks().reduce((total, task) => total + task.progress, 0) /
            this.taskCount(),
        )
      : 0,
  );
  readonly upcomingTasks = computed(() => {
    const today = this.dateInput(new Date());
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const lastDay = this.dateInput(nextWeek);
    return this.allTasks()
      .filter((task) => task.dueDate >= today && task.dueDate <= lastDay)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
      .slice(0, 6);
  });

  constructor() {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.projectsApi
      .list()
      .pipe(
        switchMap((projects) =>
          projects.length
            ? forkJoin(
                projects.map((project) =>
                  this.tasksApi.list(project.id).pipe(
                    map((tasks): ProjectSummary => ({
                      project,
                      tasks,
                      completedCount: tasks.filter(
                        (task) => task.status === 'complete',
                      ).length,
                      progress: tasks.length
                        ? Math.round(
                            tasks.reduce(
                              (total, task) => total + task.progress,
                              0,
                            ) / tasks.length,
                          )
                        : 0,
                    })),
                  ),
                ),
              )
            : of([] as ProjectSummary[]),
        ),
      )
      .subscribe({
        next: (summaries) => {
          this.summaries.set(summaries);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(
            this.apiError(
              error,
              'Could not load the overview. Check that the API and database are running.',
            ),
          );
        },
      });
  }

  trackProject(_index: number, summary: ProjectSummary): string {
    return summary.project.id;
  }

  trackTask(_index: number, task: OverviewTask): string {
    return task.id;
  }

  private dateInput(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
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
