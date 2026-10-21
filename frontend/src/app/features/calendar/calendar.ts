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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { Task, TaskStatus } from '../../core/models/task.model';
import { TaskDependency } from '../../core/models/task-dependency.model';
import { ProjectsService } from '../../core/services/projects';
import { TasksService } from '../../core/services/tasks';

interface TimelineDay {
  date: Date;
  label: string;
  isMonday: boolean;
  isToday: boolean;
}

interface TimelineTask {
  task: Task;
  depth: number;
}

interface DependencyDrag {
  taskId: string;
  side: 'before' | 'after';
}

interface TaskTimelineDrag {
  taskId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  deltaDays: number;
}

interface TaskDates {
  startDate: string;
  dueDate: string;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar {
  private readonly projectsApi = inject(ProjectsService);
  private readonly tasksApi = inject(TasksService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly selectedProjectStorageKey = 'manageit_selected_project';

  readonly projects = signal<Project[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly dependencies = signal<TaskDependency[]>([]);
  readonly selectedProjectId = signal('');
  readonly loadingProjects = signal(true);
  readonly loadingTasks = signal(false);
  readonly errorMessage = signal('');
  readonly showTaskForm = signal(false);
  readonly creatingMilestone = signal(false);
  readonly archivedView = signal(false);
  readonly viewMode = signal<'timeline' | 'list'>('timeline');
  readonly searchOpen = signal(false);
  readonly searchTerm = signal('');
  readonly notificationsOpen = signal(false);
  readonly moreActionsOpen = signal(false);
  readonly dayWidth = signal(20);
  readonly timelineDays = signal<TimelineDay[]>([]);
  readonly dependencyDrag = signal<DependencyDrag | null>(null);
  readonly dependencyDropTargetId = signal('');
  readonly taskTimelineDrag = signal<TaskTimelineDrag | null>(null);
  readonly editingTaskId = signal<string | null>(null);
  readonly openTaskMenuId = signal<string | null>(null);
  readonly savingTask = signal(false);
  readonly creatingSubtaskIds = signal<ReadonlySet<string>>(new Set());
  readonly updatingTaskIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  readonly completedCount = computed(
    () => this.displayedTasks().filter((task) => task.status === 'complete').length,
  );
  readonly inProgressCount = computed(
    () => this.displayedTasks().filter((task) => task.status === 'in_progress').length,
  );
  readonly displayedTasks = computed(() => {
    const tasks = this.tasks();
    const archived = this.archivedView();
    return tasks.filter((task) => {
      if (task.isArchived !== archived) {
        return false;
      }
      if (archived || !task.parentTaskId) {
        return true;
      }
      return !tasks.find((parent) => parent.id === task.parentTaskId)?.isArchived;
    });
  });
  readonly visibleTasks = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.displayedTasks().filter((task) =>
      !query ||
      `${task.name} ${task.assignee}`.toLocaleLowerCase().includes(query),
    );
  });
  readonly timelineTasks = computed<TimelineTask[]>(() => {
    const tasks = this.displayedTasks();
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const matches = (task: Task): boolean =>
      !query || `${task.name} ${task.assignee}`.toLocaleLowerCase().includes(query);
    const childrenByParent = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        const children = childrenByParent.get(task.parentTaskId) ?? [];
        children.push(task);
        childrenByParent.set(task.parentTaskId, children);
      }
    }
    const sortByDate = (left: Task, right: Task): number =>
      left.startDate.localeCompare(right.startDate) ||
      left.name.localeCompare(right.name);
    const taskIds = new Set(tasks.map((task) => task.id));
    const roots = tasks
      .filter((task) => !task.parentTaskId || !taskIds.has(task.parentTaskId))
      .sort(sortByDate);
    return roots.flatMap((parent) => {
      const children = (childrenByParent.get(parent.id) ?? []).sort(sortByDate);
      const parentMatches = matches(parent);
      const matchingChildren = children.filter(matches);
      if (query && !parentMatches && !matchingChildren.length) {
        return [];
      }
      return [
        { task: parent, depth: 0 },
        ...children
          .filter((task) => !query || parentMatches || matches(task))
          .map((task) => ({ task, depth: 1 })),
      ];
    });
  });
  readonly visibleDependencies = computed(() => {
    const visibleIds = new Set(this.timelineTasks().map(({ task }) => task.id));
    return this.dependencies().filter(
      (dependency) =>
        visibleIds.has(dependency.predecessorTaskId) &&
        visibleIds.has(dependency.successorTaskId),
    );
  });
  readonly upcomingTasks = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return this.displayedTasks()
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
    this.displayedTasks().length
      ? Math.round(
          this.displayedTasks().reduce((total, task) => total + task.progress, 0) /
            this.displayedTasks().length,
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

  taskName = '';
  taskAssignee = '';
  taskStartDate = this.dateInput(new Date());
  taskDueDate = this.dateInput(new Date(Date.now() + 7 * 86400000));
  editedTaskName = '';
  editedTaskAssignee = '';
  editedTaskStartDate = '';
  editedTaskDueDate = '';
  editedTaskProgress = 0;
  editedTaskStatus: TaskStatus = 'not_started';
  private projectsLoaded = false;
  private requestedProjectId = '';
  private loadedTaskProjectId = '';
  private requestedTaskProjectId = '';

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.requestedProjectId = params.get('project') ?? '';
      if (this.projectsLoaded) this.applyProjectSelection();
    });
    this.loadProjects();
  }

  loadProjects(): void {
    this.loadingProjects.set(true);
    this.projectsApi.list().subscribe({
      next: (projects) => {
        this.projects.set(projects.filter((project) => !project.isArchived));
        this.loadingProjects.set(false);
        this.errorMessage.set('');
        this.projectsLoaded = true;
        this.applyProjectSelection();
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

  selectProject(project: Project, updateUrl = true): void {
    const changed = this.selectedProjectId() !== project.id;
    this.selectedProjectId.set(project.id);
    localStorage.setItem(this.selectedProjectStorageKey, project.id);
    if (changed) {
      this.tasks.set([]);
      this.dependencies.set([]);
      this.updateTimeline([]);
    }
    if (
      updateUrl &&
      this.route.snapshot.queryParamMap.get('project') !== project.id
    ) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { project: project.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    if (
      changed ||
      (this.loadedTaskProjectId !== project.id &&
        this.requestedTaskProjectId !== project.id)
    ) {
      this.loadTasks(project.id);
    }
  }

  selectProjectById(id: string): void {
    const project = this.projects().find((item) => item.id === id);
    if (project) this.selectProject(project);
  }

  setArchivedView(archived: boolean): void {
    this.archivedView.set(archived);
    this.openTaskMenuId.set(null);
    this.editingTaskId.set(null);
    this.showTaskForm.set(false);
    this.creatingMilestone.set(false);
    this.updateTimeline(this.displayedTasks());
  }

  toggleTaskForm(): void {
    this.showTaskForm.update((visible) => !visible);
    if (!this.showTaskForm()) this.creatingMilestone.set(false);
  }

  openTaskForm(): void {
    this.creatingMilestone.set(false);
    this.showTaskForm.set(true);
  }

  openMilestoneForm(): void {
    this.creatingMilestone.set(true);
    this.showTaskForm.set(true);
  }

  loadTasks(projectId = this.selectedProjectId()): void {
    if (!projectId) return;
    this.loadingTasks.set(true);
    this.requestedTaskProjectId = projectId;
    forkJoin({
      tasks: this.tasksApi.list(projectId),
      dependencies: this.tasksApi.listDependencies(projectId),
    }).subscribe({
      next: ({ tasks, dependencies }) => {
        if (
          this.selectedProjectId() !== projectId ||
          this.requestedTaskProjectId !== projectId
        ) {
          return;
        }
        this.tasks.set(tasks);
        this.dependencies.set(dependencies);
        this.loadingTasks.set(false);
        this.errorMessage.set('');
        this.loadedTaskProjectId = projectId;
        this.requestedTaskProjectId = '';
        this.updateTimeline(this.displayedTasks());
      },
      error: (error: unknown) => {
        if (
          this.selectedProjectId() !== projectId ||
          this.requestedTaskProjectId !== projectId
        ) {
          return;
        }
        this.loadingTasks.set(false);
        this.requestedTaskProjectId = '';
        this.errorMessage.set(
          this.apiError(error, 'Could not load tasks. Please try again.'),
        );
      },
    });
  }

  createTask(): void {
    const projectId = this.selectedProjectId();
    if (!projectId || !this.taskName.trim()) return;
    this.tasksApi
      .create(projectId, {
        name: this.taskName.trim(),
        assignee: this.creatingMilestone() ? '' : this.taskAssignee.trim(),
        isMilestone: this.creatingMilestone(),
        startDate: this.taskStartDate,
        dueDate: this.creatingMilestone()
          ? this.taskStartDate
          : this.taskDueDate,
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((tasks) =>
            [...tasks, task].sort((left, right) =>
              left.startDate.localeCompare(right.startDate),
            ),
          );
          this.updateTimeline(this.displayedTasks());
          this.taskName = '';
          this.taskAssignee = '';
          this.showTaskForm.set(false);
          this.creatingMilestone.set(false);
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

  addSubtask(parent: Task): void {
    if (
      parent.parentTaskId ||
      parent.isMilestone ||
      this.creatingSubtaskIds().has(parent.id)
    ) {
      return;
    }
    this.openTaskMenuId.set(null);
    this.creatingSubtaskIds.update((ids) => new Set(ids).add(parent.id));
    this.tasksApi
      .create(this.selectedProjectId(), {
        name: 'Subtask',
        assignee: '',
        parentTaskId: parent.id,
        startDate: parent.startDate,
        dueDate: parent.dueDate,
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((tasks) => [...tasks, task]);
          this.updateTimeline(this.displayedTasks());
          this.creatingSubtaskIds.update((ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(parent.id);
            return nextIds;
          });
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.creatingSubtaskIds.update((ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(parent.id);
            return nextIds;
          });
          this.errorMessage.set(
            this.apiError(error, 'Could not add a subtask. Please try again.'),
          );
        },
      });
  }

  canCreateTask(): boolean {
    return (
      Boolean(this.taskName.trim()) &&
      Boolean(this.taskStartDate) &&
      (this.creatingMilestone() ||
        this.taskStartDate <= this.taskDueDate)
    );
  }

  startDependencyDrag(
    event: PointerEvent,
    task: Task,
    side: 'before' | 'after',
  ): void {
    if (this.archivedView()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.dependencyDrag.set({ taskId: task.id, side });
    this.dependencyDropTargetId.set('');
  }

  startTaskTimelineDrag(
    event: PointerEvent,
    task: Task,
    mode: TaskTimelineDrag['mode'],
  ): void {
    if (
      event.button !== 0 ||
      this.dependencyDrag() ||
      this.archivedView() ||
      (task.isMilestone && mode !== 'move')
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.taskTimelineDrag.set({
      taskId: task.id,
      mode,
      startX: event.clientX,
      deltaDays: 0,
    });
  }

  @HostListener('document:pointermove', ['$event'])
  updateDependencyDropTarget(event: PointerEvent): void {
    const taskDrag = this.taskTimelineDrag();
    if (taskDrag) {
      const deltaDays = Math.round(
        (event.clientX - taskDrag.startX) / this.dayWidth(),
      );
      this.taskTimelineDrag.set({ ...taskDrag, deltaDays });
      return;
    }
    if (!this.dependencyDrag()) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target?.closest<HTMLElement>('.calendar-task-row');
    this.dependencyDropTargetId.set(row?.dataset['taskId'] ?? '');
  }

  @HostListener('document:pointerup', ['$event'])
  finishDependencyDrag(event: PointerEvent): void {
    const taskDrag = this.taskTimelineDrag();
    if (taskDrag) {
      const task = this.tasks().find((item) => item.id === taskDrag.taskId);
      const dates = task ? this.taskDatesFor(task) : null;
      this.taskTimelineDrag.set(null);
      if (
        task &&
        dates &&
        (dates.startDate !== task.startDate || dates.dueDate !== task.dueDate)
      ) {
        this.saveTaskDates(task, dates);
      }
      return;
    }
    const drag = this.dependencyDrag();
    const dropTargetId = this.dependencyDropTargetId();
    this.dependencyDrag.set(null);
    this.dependencyDropTargetId.set('');
    if (!drag) {
      return;
    }

    const eventTarget =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.calendar-task-row')
        : null;
    const targetId = dropTargetId || eventTarget?.dataset['taskId'];
    if (!targetId || targetId === drag.taskId) {
      return;
    }
    const predecessorTaskId =
      drag.side === 'after' ? drag.taskId : targetId;
    const successorTaskId =
      drag.side === 'after' ? targetId : drag.taskId;
    this.createDependency(predecessorTaskId, successorTaskId);
  }

  @HostListener('document:pointercancel')
  clearDependencyDrag(): void {
    this.dependencyDrag.set(null);
    this.dependencyDropTargetId.set('');
    this.taskTimelineDrag.set(null);
  }

  toggleTaskMenu(taskId: string): void {
    this.openTaskMenuId.update((current) =>
      current === taskId ? null : taskId,
    );
  }

  archiveTask(task: Task): void {
    this.setTaskArchived(task, true);
  }

  restoreTask(task: Task): void {
    this.setTaskArchived(task, false);
  }

  deleteTask(task: Task): void {
    const descendants = this.tasks().filter(
      (item) => item.parentTaskId === task.id,
    );
    const cascadeDescription = descendants.length
      ? ' and its subtasks'
      : '';
    if (
      !window.confirm(
        `Permanently delete "${task.name}"${cascadeDescription} and its dependencies? This cannot be undone.`,
      )
    ) {
      this.openTaskMenuId.set(null);
      return;
    }

    this.openTaskMenuId.set(null);
    this.updatingTaskIds.update((ids) => new Set(ids).add(task.id));
    this.tasksApi.delete(task.id).subscribe({
      next: () => {
        const deletedIds = new Set([
          task.id,
          ...descendants.map((item) => item.id),
        ]);
        this.tasks.update((tasks) =>
          tasks.filter((item) => !deletedIds.has(item.id)),
        );
        this.dependencies.update((dependencies) =>
          dependencies.filter(
            (dependency) =>
              !deletedIds.has(dependency.predecessorTaskId) &&
              !deletedIds.has(dependency.successorTaskId),
          ),
        );
        this.updatingTaskIds.update((ids) => {
          const nextIds = new Set(ids);
          nextIds.delete(task.id);
          return nextIds;
        });
        this.updateTimeline(this.displayedTasks());
        this.errorMessage.set('');
      },
      error: (error: unknown) => {
        this.updatingTaskIds.update((ids) => {
          const nextIds = new Set(ids);
          nextIds.delete(task.id);
          return nextIds;
        });
        this.errorMessage.set(
          this.apiError(error, 'Could not delete the task. Please try again.'),
        );
      },
    });
  }

  isUpdatingTask(taskId: string): boolean {
    return this.updatingTaskIds().has(taskId);
  }

  private setTaskArchived(task: Task, isArchived: boolean): void {
    if (this.isUpdatingTask(task.id)) {
      return;
    }
    this.openTaskMenuId.set(null);
    this.updatingTaskIds.update((ids) => new Set(ids).add(task.id));
    this.tasksApi.update(task.id, { isArchived }).subscribe({
      next: (updatedTask) => {
        this.tasks.update((tasks) =>
          tasks.map((item) =>
            item.id === task.id ? updatedTask : item,
          ),
        );
        this.updatingTaskIds.update((ids) => {
          const nextIds = new Set(ids);
          nextIds.delete(task.id);
          return nextIds;
        });
        this.updateTimeline(this.displayedTasks());
        this.errorMessage.set('');
      },
      error: (error: unknown) => {
        this.updatingTaskIds.update((ids) => {
          const nextIds = new Set(ids);
          nextIds.delete(task.id);
          return nextIds;
        });
        this.errorMessage.set(
          this.apiError(
            error,
            `Could not ${isArchived ? 'archive' : 'restore'} the task. Please try again.`,
          ),
        );
      },
    });
  }

  startEditingTask(task: Task): void {
    this.openTaskMenuId.set(null);
    this.editingTaskId.set(task.id);
    this.editedTaskName = task.name;
    this.editedTaskAssignee = task.assignee;
    this.editedTaskStartDate = task.startDate;
    this.editedTaskDueDate = task.dueDate;
    this.editedTaskProgress = task.progress;
    this.editedTaskStatus = task.status;
  }

  editingTaskIsMilestone(): boolean {
    return (
      this.tasks().find((task) => task.id === this.editingTaskId())
        ?.isMilestone ?? false
    );
  }

  cancelTaskEdit(): void {
    this.editingTaskId.set(null);
  }

  canSaveTaskEdit(): boolean {
    const task = this.tasks().find((item) => item.id === this.editingTaskId());
    if (!task) return false;
    const bounds = this.taskDateBounds(task);
    const dueDate = task.isMilestone
      ? this.editedTaskStartDate
      : this.editedTaskDueDate;
    return (
      Boolean(this.editedTaskName.trim()) &&
      this.editedTaskName.trim().length <= 120 &&
      this.editedTaskAssignee.trim().length <= 120 &&
      Boolean(this.editedTaskStartDate) &&
      Boolean(dueDate) &&
      this.editedTaskStartDate <= dueDate &&
      (!bounds.minimumStart ||
        this.editedTaskStartDate >= bounds.minimumStart) &&
      (!bounds.maximumStart ||
        this.editedTaskStartDate <= bounds.maximumStart) &&
      (!bounds.minimumDue || dueDate >= bounds.minimumDue) &&
      (!bounds.maximumDue || dueDate <= bounds.maximumDue) &&
      Number.isInteger(this.editedTaskProgress) &&
      this.editedTaskProgress >= 0 &&
      this.editedTaskProgress <= 100 &&
      !this.savingTask()
    );
  }

  saveTaskEdit(): void {
    const taskId = this.editingTaskId();
    const task = this.tasks().find((item) => item.id === taskId);
    if (!taskId || !task || !this.canSaveTaskEdit()) {
      return;
    }
    this.savingTask.set(true);
    this.tasksApi
      .update(taskId, {
        name: this.editedTaskName.trim(),
        assignee: this.editedTaskAssignee.trim(),
        startDate: this.editedTaskStartDate,
        dueDate: task.isMilestone
          ? this.editedTaskStartDate
          : this.editedTaskDueDate,
        progress: this.editedTaskProgress,
        status: this.editedTaskStatus,
      })
      .subscribe({
        next: (updated) => {
          this.tasks.update((tasks) =>
            tasks.map((task) => (task.id === taskId ? updated : task)),
          );
          this.updateTimeline(this.displayedTasks());
          this.editingTaskId.set(null);
          this.savingTask.set(false);
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.savingTask.set(false);
          this.errorMessage.set(
            this.apiError(error, 'Could not update task details. Please try again.'),
          );
        },
      });
  }

  @HostListener('document:click', ['$event'])
  closeTaskMenuOnOutsideClick(event: MouseEvent): void {
    if (
      event.target instanceof Element &&
      !event.target.closest('.task-actions')
    ) {
      this.openTaskMenuId.set(null);
    }
  }

  taskDatesFor(task: Task): TaskDates {
    const drag = this.taskTimelineDrag();
    if (!drag || drag.taskId !== task.id || drag.deltaDays === 0) {
      return { startDate: task.startDate, dueDate: task.dueDate };
    }

    const range = this.taskDateBounds(task);
    if (drag.mode === 'move') {
      const minimumShift = range.minimumStart
        ? this.dayDifference(task.startDate, range.minimumStart)
        : Number.NEGATIVE_INFINITY;
      const minimumDueShift = range.minimumDue
        ? this.dayDifference(task.dueDate, range.minimumDue)
        : Number.NEGATIVE_INFINITY;
      const maximumStartShift = range.maximumStart
        ? this.dayDifference(task.startDate, range.maximumStart)
        : Number.POSITIVE_INFINITY;
      const maximumDueShift = range.maximumDue
        ? this.dayDifference(task.dueDate, range.maximumDue)
        : Number.POSITIVE_INFINITY;
      const shift = this.clamp(
        drag.deltaDays,
        Math.max(minimumShift, minimumDueShift),
        Math.min(maximumStartShift, maximumDueShift),
      );
      return {
        startDate: this.shiftDate(task.startDate, shift),
        dueDate: this.shiftDate(task.dueDate, shift),
      };
    }
    if (drag.mode === 'resize-start') {
      const latestStart = [
        task.dueDate,
        range.maximumStart ?? task.dueDate,
      ].sort()[0];
      const startDate = this.shiftDate(
        task.startDate,
        this.clamp(
          drag.deltaDays,
          range.minimumStart
            ? this.dayDifference(task.startDate, range.minimumStart)
            : Number.NEGATIVE_INFINITY,
          this.dayDifference(task.startDate, latestStart),
        ),
      );
      return { startDate, dueDate: task.dueDate };
    }

    const earliestDue = [
      task.startDate,
      range.minimumDue ?? task.startDate,
    ].sort().at(-1)!;
    const dueDate = this.shiftDate(
      task.dueDate,
      this.clamp(
        drag.deltaDays,
        this.dayDifference(task.dueDate, earliestDue),
        range.maximumDue
          ? this.dayDifference(task.dueDate, range.maximumDue)
          : Number.POSITIVE_INFINITY,
      ),
    );
    return { startDate: task.startDate, dueDate };
  }

  createDependency(predecessorTaskId: string, successorTaskId: string): void {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return;
    }
    this.tasksApi
      .createDependency(projectId, predecessorTaskId, successorTaskId)
      .subscribe({
        next: (dependency) => {
          this.dependencies.update((dependencies) => [...dependencies, dependency]);
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.apiError(
              error,
              'Could not link these tasks. Check the dependency and try again.',
            ),
          );
        },
      });
  }

  removeDependency(dependency: TaskDependency): void {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return;
    }
    this.tasksApi.deleteDependency(projectId, dependency.id).subscribe({
      next: () => {
        this.dependencies.update((dependencies) =>
          dependencies.filter((item) => item.id !== dependency.id),
        );
        this.errorMessage.set('');
      },
      error: (error: unknown) =>
        this.errorMessage.set(
          this.apiError(error, 'Could not remove this dependency. Please try again.'),
        ),
    });
  }

  taskNameFor(id: string): string {
    return this.tasks().find((task) => task.id === id)?.name ?? 'Unknown task';
  }

  dependencyPath(dependency: TaskDependency): string {
    const predecessor = this.tasks().find(
      (task) => task.id === dependency.predecessorTaskId,
    );
    const successor = this.tasks().find(
      (task) => task.id === dependency.successorTaskId,
    );
    if (!predecessor || !successor) {
      return '';
    }
    const rows = this.timelineTasks();
    const sourceRow = rows.findIndex(
      ({ task }) => task.id === predecessor.id,
    );
    const targetRow = rows.findIndex(({ task }) => task.id === successor.id);
    if (sourceRow < 0 || targetRow < 0) {
      return '';
    }
    const timelineWidth = this.timelineWidth();
    const startX = ((this.taskOffset(predecessor) + this.taskWidth(predecessor)) / 100) * timelineWidth;
    const endX = (this.taskOffset(successor) / 100) * timelineWidth;
    const startY = sourceRow * 52 + 26;
    const endY = targetRow * 52 + 26;
    const curve = Math.max(24, Math.abs(endX - startX) * 0.45);
    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  }

  timelineWidth(): number {
    return this.timelineDays().length * this.dayWidth();
  }

  timelineHeight(): number {
    return Math.max(this.timelineTasks().length * 52, 1);
  }

  trackTimelineTask(_index: number, row: TimelineTask): string {
    return row.task.id;
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
    if (this.archivedView()) return 'No archived tasks in this project.';
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
      ['Type', 'Task', 'Assignee', 'Start date', 'Due date', 'Status', 'Progress'],
      ...this.visibleTasks().map((task) => [
        task.isMilestone ? 'Milestone' : 'Task',
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
    const dates = this.taskDatesFor(task);
    const markerOffset = task.isMilestone ? 0.5 : 0;
    return Math.max(
      0,
      ((this.dayIndex(dates.startDate) + markerOffset) / days.length) * 100,
    );
  }

  taskWidth(task: Task): number {
    const days = this.timelineDays();
    if (!days.length || task.isMilestone) return 0;
    const dates = this.taskDatesFor(task);
    const start = this.dayIndex(dates.startDate);
    const end = this.dayIndex(dates.dueDate);
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

  private applyProjectSelection(): void {
    const preferredId =
      this.requestedProjectId ||
      localStorage.getItem(this.selectedProjectStorageKey) ||
      '';
    const project =
      this.projects().find((item) => item.id === preferredId) ??
      this.projects()[0];
    if (project) {
      this.selectProject(project, this.requestedProjectId !== project.id);
      return;
    }

    this.selectedProjectId.set('');
    this.loadedTaskProjectId = '';
    this.requestedTaskProjectId = '';
    this.tasks.set([]);
    this.dependencies.set([]);
    this.loadingTasks.set(false);
    this.updateTimeline([]);
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

  private taskDateBounds(task: Task): {
    minimumStart?: string;
    maximumStart?: string;
    minimumDue?: string;
    maximumDue?: string;
  } {
    if (task.parentTaskId) {
      const parent = this.tasks().find((item) => item.id === task.parentTaskId);
      return {
        minimumStart: parent?.startDate,
        maximumDue: parent?.dueDate,
      };
    }

    const subtasks = this.tasks().filter(
      (item) => item.parentTaskId === task.id,
    );
    if (!subtasks.length) {
      return {};
    }
    return {
      maximumStart: subtasks
        .map((subtask) => subtask.startDate)
        .sort()[0],
      minimumDue: subtasks
        .map((subtask) => subtask.dueDate)
        .sort()
        .at(-1),
    };
  }

  private saveTaskDates(task: Task, dates: TaskDates): void {
    const previousTasks = this.tasks();
    this.tasks.update((tasks) =>
      tasks.map((item) =>
        item.id === task.id ? { ...item, ...dates } : item,
      ),
    );
    this.updateTimeline(this.displayedTasks());
    this.tasksApi
      .update(task.id, dates)
      .subscribe({
        next: (updated) => {
          this.tasks.update((tasks) =>
            tasks.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.updateTimeline(this.displayedTasks());
          this.errorMessage.set('');
        },
        error: (error: unknown) => {
          this.tasks.set(previousTasks);
          this.updateTimeline(this.displayedTasks());
          this.errorMessage.set(
            this.apiError(
              error,
              'Could not update the task dates. Check the task and subtask date ranges.',
            ),
          );
        },
      });
  }

  private dayDifference(from: string, to: string): number {
    return (
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000
    );
  }

  private shiftDate(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
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
