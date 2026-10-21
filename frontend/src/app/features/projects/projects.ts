import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project } from '../../core/models/project.model';
import { Task, TaskStatus } from '../../core/models/task.model';
import { ProjectsService } from '../../core/services/projects';
import { TasksService } from '../../core/services/tasks';

interface TimelineDay {
  date: Date;
  label: string;
  isMonday: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private readonly projectsApi = inject(ProjectsService);
  private readonly tasksApi = inject(TasksService);

  readonly projects = signal<Project[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly selectedProjectId = signal('');
  readonly loadingProjects = signal(true);
  readonly loadingTasks = signal(false);
  readonly errorMessage = signal('');
  readonly showProjectForm = signal(false);
  readonly showTaskForm = signal(false);
  readonly viewMode = signal<'timeline' | 'list'>('timeline');
  readonly searchOpen = signal(false);
  readonly searchTerm = signal('');
  readonly notificationsOpen = signal(false);
  readonly moreActionsOpen = signal(false);
  readonly dayWidth = signal(20);
  readonly timelineDays = signal<TimelineDay[]>([]);
  readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  readonly completedCount = computed(
    () => this.tasks().filter((task) => task.status === 'complete').length,
  );
  readonly inProgressCount = computed(
    () => this.tasks().filter((task) => task.status === 'in_progress').length,
  );
  readonly visibleTasks = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.tasks().filter((task) =>
      !query ||
      `${task.name} ${task.assignee}`.toLocaleLowerCase().includes(query),
    );
  });
  readonly upcomingTasks = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return this.tasks()
      .filter((task) => new Date(`${task.dueDate}T00:00:00`) <= nextWeek)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  });
  readonly zoomLabel = computed(() =>
    this.dayWidth() <= 20
      ? 'Compact'
      : this.dayWidth() >= 36
        ? 'Detailed'
        : 'Comfortable',
  );
  readonly overallProgress = computed(() =>
    this.tasks().length
      ? Math.round(
          this.tasks().reduce((total, task) => total + task.progress, 0) /
            this.tasks().length,
        )
      : 0,
  );
  readonly monthHeaders = computed(() => {
    const days = this.timelineDays();
    const months: { label: string; index: number }[] = [];
    days.forEach((day, index) => {
      const label = day.date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (months.at(-1)?.label !== label) months.push({ label, index });
    });
    return months.map((month, index) => ({
      label: month.label,
      width:
        (((months[index + 1]?.index ?? days.length) - month.index) /
          Math.max(days.length, 1)) *
        100,
    }));
  });

  projectName = '';
  taskName = '';
  taskAssignee = '';
  taskStartDate = this.dateInput(new Date());
  taskDueDate = this.dateInput(new Date(Date.now() + 7 * 86400000));

  constructor() {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loadingProjects.set(true);
    this.projectsApi.list().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loadingProjects.set(false);
        this.errorMessage.set('');
        if (projects.length) {
          const selected = projects.find(
            (project) => project.id === this.selectedProjectId(),
          );
          this.selectProject(selected ?? projects[0]);
        }
      },
      error: (error: unknown) => {
        this.loadingProjects.set(false);
        this.errorMessage.set(
          this.apiError(
            error,
            'Could not load projects. Check that the API and database are running.',
          ),
        );
      },
    });
  }

  selectProject(project: Project): void {
    this.selectedProjectId.set(project.id);
    this.loadTasks(project.id);
  }

  toggleProjectForm(): void {
    this.showProjectForm.update((visible) => !visible);
  }

  toggleTaskForm(): void {
    this.showTaskForm.update((visible) => !visible);
  }

  openTaskForm(): void {
    this.showTaskForm.set(true);
  }

  loadTasks(projectId = this.selectedProjectId()): void {
    if (!projectId) return;
    this.loadingTasks.set(true);
    this.tasksApi.list(projectId).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loadingTasks.set(false);
        this.errorMessage.set('');
        this.updateTimeline(tasks);
      },
      error: (error: unknown) => {
        this.loadingTasks.set(false);
        this.errorMessage.set(
          this.apiError(error, 'Could not load tasks. Please try again.'),
        );
      },
    });
  }

  createProject(): void {
    const name = this.projectName.trim();
    if (!name) return;
    this.projectsApi.create(name).subscribe({
      next: (project) => {
        this.projects.update((projects) => [...projects, project]);
        this.projectName = '';
        this.showProjectForm.set(false);
        this.errorMessage.set('');
        this.selectProject(project);
      },
      error: (error: unknown) =>
        this.errorMessage.set(
          this.apiError(error, 'Could not create project. Please try again.'),
        ),
    });
  }

  createTask(): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.taskName.trim()) return;
    this.tasksApi
      .create(projectId, {
        name: this.taskName.trim(),
        assignee: this.taskAssignee.trim(),
        startDate: this.taskStartDate,
        dueDate: this.taskDueDate,
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((tasks) =>
            [...tasks, task].sort((left, right) =>
              left.startDate.localeCompare(right.startDate),
            ),
          );
          this.updateTimeline(this.tasks());
          this.taskName = '';
          this.taskAssignee = '';
          this.showTaskForm.set(false);
          this.errorMessage.set('');
        },
        error: (error: unknown) =>
          this.errorMessage.set(
            this.apiError(
              error,
              'Could not create task. Check the dates and try again.',
            ),
          ),
      });
  }

  advanceTask(task: Task): void {
    const progress = task.progress >= 100 ? 0 : Math.min(100, task.progress + 25);
    const status: TaskStatus =
      progress === 100
        ? 'complete'
        : progress > 0
          ? 'in_progress'
          : 'not_started';
    this.tasksApi.update(task.id, { progress, status }).subscribe({
      next: (updated) => {
        this.tasks.update((tasks) =>
          tasks.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.errorMessage.set('');
      },
      error: (error: unknown) =>
        this.errorMessage.set(
          this.apiError(error, 'Could not update task progress. Please try again.'),
        ),
    });
  }

  projectColor(name: string): string {
    const colors = [
      'var(--color-accent)',
      'var(--color-secondary)',
      'var(--color-success)',
      'var(--color-warning)',
    ];
    return colors[name.length % colors.length];
  }

  setViewMode(mode: 'timeline' | 'list'): void {
    this.viewMode.set(mode);
  }

  toggleSearch(): void {
    const opening = !this.searchOpen();
    this.searchOpen.set(opening);
    this.notificationsOpen.set(false);
    if (opening) {
      requestAnimationFrame(() => document.getElementById('task-search')?.focus());
    } else {
      this.searchTerm.set('');
    }
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchTerm.set('');
  }

  toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
    this.searchOpen.set(false);
    this.moreActionsOpen.set(false);
  }

  toggleMoreActions(): void {
    this.moreActionsOpen.update((open) => !open);
    this.notificationsOpen.set(false);
    this.searchOpen.set(false);
  }

  changeZoom(amount: number): void {
    this.dayWidth.update((width) => Math.max(12, Math.min(40, width + amount)));
  }

  emptyTaskMessage(): string {
    if (this.searchTerm().trim()) return 'No tasks match your search.';
    return 'No tasks yet. Add the first task to start your timeline.';
  }

  focusTask(task: Task): void {
    this.notificationsOpen.set(false);
    this.viewMode.set('timeline');
    requestAnimationFrame(() =>
      document.getElementById(`task-${task.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      }),
    );
  }

  exportTasksCsv(): void {
    const quote = (value: string): string => {
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const rows = [
      ['Task', 'Assignee', 'Start date', 'Due date', 'Status', 'Progress'],
      ...this.visibleTasks().map((task) => [
        task.name,
        task.assignee,
        task.startDate,
        task.dueDate,
        task.status.replace('_', ' '),
        `${task.progress}%`,
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.selectedProject()?.name ?? 'manageit-tasks'}.csv`.replace(
      /[<>:"/\\|?*]/g,
      '-',
    );
    link.click();
    URL.revokeObjectURL(url);
    this.moreActionsOpen.set(false);
  }

  taskOffset(task: Task): number {
    const days = this.timelineDays();
    if (!days.length) return 0;
    return Math.max(0, (this.dayIndex(task.startDate) / days.length) * 100);
  }

  taskWidth(task: Task): number {
    const days = this.timelineDays();
    if (!days.length) return 0;
    const start = this.dayIndex(task.startDate);
    const end = this.dayIndex(task.dueDate);
    return Math.max(2, (Math.max(1, end - start + 1) / days.length) * 100);
  }

  todayOffset(): number {
    const days = this.timelineDays();
    if (!days.length) return -1;
    return (this.dayIndex(this.dateInput(new Date())) / days.length) * 100;
  }

  scrollToToday(): void {
    if (this.viewMode() !== 'timeline') this.setViewMode('timeline');
    requestAnimationFrame(() =>
      document.querySelector('.today-line')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      }),
    );
  }

  trackTask(_index: number, task: Task): string {
    return task.id;
  }

  private updateTimeline(tasks: Task[]): void {
    const today = new Date();
    const date = (value: string): Date => new Date(`${value}T00:00:00`);
    const earliest = tasks.length
      ? new Date(Math.min(...tasks.map((task) => date(task.startDate).getTime())))
      : today;
    const latest = tasks.length
      ? new Date(Math.max(...tasks.map((task) => date(task.dueDate).getTime())))
      : today;
    const start = new Date(Math.min(earliest.getTime(), today.getTime()));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(Math.max(latest.getTime(), today.getTime()));
    end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7)) + 7);
    const days: TimelineDay[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const copy = new Date(cursor);
      days.push({
        date: copy,
        label: String(copy.getDate()),
        isMonday: copy.getDay() === 1,
        isToday: this.dateInput(copy) === this.dateInput(today),
      });
    }
    this.timelineDays.set(days);
  }

  private dayIndex(value: string): number {
    const days = this.timelineDays();
    if (!days.length) return 0;
    const first = new Date(days[0].date);
    const target = new Date(`${value}T00:00:00`);
    return Math.max(0, Math.round((target.getTime() - first.getTime()) / 86400000));
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
