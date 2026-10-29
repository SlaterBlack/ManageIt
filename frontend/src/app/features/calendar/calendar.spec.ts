import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { Project } from '../../core/models/project.model';
import { Task, TaskUpdate } from '../../core/models/task.model';
import { ProjectsService } from '../../core/services/projects';
import { TasksService } from '../../core/services/tasks';
import { GanttImporter } from './gantt-importer';
import { Calendar } from './calendar';

const project: Project = {
  id: 'project-1',
  projectCode: '123',
  name: 'Project',
  description: '',
  color: '#D87535',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const task: Task = {
  id: 'task-1',
  projectId: project.id,
  parentTaskId: null,
  isMilestone: false,
  isArchived: false,
  name: 'Task',
  color: project.color,
  assignee: '',
  startDate: '2026-01-01',
  dueDate: '2026-01-03',
  progress: 40,
  status: 'in_progress',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Calendar group changes', () => {
  let component: Calendar;
  let fixture: ComponentFixture<Calendar>;
  let updateTask: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateTask = vi.fn((taskId: string, update: TaskUpdate) =>
      of({ ...task, id: taskId, ...update }),
    );
    await TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [
        {
          provide: ProjectsService,
          useValue: { list: () => of([project]) },
        },
        {
          provide: TasksService,
          useValue: {
            list: () => of([task]),
            listDependencies: () => of([]),
            update: updateTask,
          },
        },
        { provide: GanttImporter, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({ project: project.id })),
            snapshot: { queryParamMap: convertToParamMap({ project: project.id }) },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.tasks.set([task]);
    component.selectedTaskIds.set(new Set([task.id]));
    component.groupChangeMode.set(true);
  });

  it('sets completed tasks to 100 percent', async () => {
    component.groupStatus = 'complete';

    component.applyGroupStatus();
    await Promise.resolve();

    expect(updateTask).toHaveBeenCalledWith(task.id, {
      status: 'complete',
      progress: 100,
    });
    expect(component.tasks()[0].progress).toBe(100);
  });

  it('marks a parent task and its subtasks complete together', async () => {
    const subtask: Task = {
      ...task,
      id: 'subtask-1',
      parentTaskId: task.id,
      name: 'Subtask',
      status: 'not_started',
      progress: 0,
    };
    component.tasks.set([task, subtask]);
    component.groupStatus = 'complete';

    component.applyGroupStatus();
    await Promise.resolve();

    expect(component.tasks()[0].status).toBe('complete');
    expect(component.tasks()[1].status).toBe('complete');
    expect(component.tasks()[1].progress).toBe(100);
  });

  it('applies a color to every selected task', async () => {
    component.groupColor = '#336699';

    component.applyGroupColor();
    await Promise.resolve();

    expect(updateTask).toHaveBeenCalledWith(task.id, { color: '#336699' });
    expect(component.tasks()[0].color).toBe('#336699');
  });

  it('saves an individual task color from the task editor', () => {
    component.groupChangeMode.set(false);
    const subtask: Task = {
      ...task,
      id: 'subtask-1',
      parentTaskId: task.id,
      name: 'Subtask',
    };
    component.tasks.set([task, subtask]);
    component.startEditingTask(task);
    component.editedTaskColor = '#336699';
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('.task-bar') as HTMLElement).style
        .getPropertyValue('--task-color'),
    ).toBe('#336699');

    component.saveTaskEdit();
    fixture.detectChanges();

    expect(updateTask).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ color: '#336699' }),
    );
    expect(component.tasks()[0].color).toBe('#336699');
    expect(component.tasks()[1].color).toBe('#336699');
    expect(
      (fixture.nativeElement.querySelector('.task-bar') as HTMLElement).style
        .getPropertyValue('--task-color'),
    ).toBe('#336699');
  });

  it('opens task edit fields from the task options button', () => {
    component.groupChangeMode.set(false);

    component.toggleTaskMenu(task);
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.task-edit-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.textContent).toContain('Rename');
    expect(menu.textContent).toContain('Assignee');
    expect(menu.textContent).toContain('Task state and progress');
    expect(menu.querySelector('.task-menu-fieldset app-project-color-picker')).not.toBeNull();
    expect(menu.querySelector('.task-menu-color')).toBeNull();
    expect(menu.textContent).toContain('Dates');
    expect(menu.querySelector('[name="editedTaskName"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskAssignee"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskStatus"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskProgress"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskIsMilestone"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskStartDate"]')).not.toBeNull();
    expect(menu.querySelector('[name="editedTaskDueDate"]')).not.toBeNull();
  });

  it('converts a task to a milestone and collapses its dates', () => {
    component.groupChangeMode.set(false);
    component.tasks.set([task]);
    component.startEditingTask(task);
    component.editedTaskIsMilestone = true;

    expect(component.canSaveTaskEdit()).toBe(true);
    component.saveTaskEdit();

    expect(updateTask).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        isMilestone: true,
        startDate: task.startDate,
        dueDate: task.startDate,
      }),
    );
    expect(component.tasks()[0].isMilestone).toBe(true);
    expect(component.tasks()[0].dueDate).toBe(task.startDate);
  });

  it('converts a milestone back to a task', () => {
    component.groupChangeMode.set(false);
    const milestone: Task = {
      ...task,
      isMilestone: true,
      dueDate: task.startDate,
    };
    component.tasks.set([milestone]);
    component.startEditingTask(milestone);
    component.editedTaskIsMilestone = false;
    component.editedTaskDueDate = task.dueDate;

    component.saveTaskEdit();

    expect(updateTask).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        isMilestone: false,
        startDate: task.startDate,
        dueDate: task.dueDate,
      }),
    );
    expect(component.tasks()[0].isMilestone).toBe(false);
    expect(component.tasks()[0].dueDate).toBe(task.dueDate);
  });

  it('prevents converting parents with subtasks into milestones', () => {
    component.groupChangeMode.set(false);
    const subtask: Task = {
      ...task,
      id: 'subtask-1',
      parentTaskId: task.id,
      name: 'Subtask',
    };
    component.tasks.set([task, subtask]);
    component.startEditingTask(task);
    component.editedTaskIsMilestone = true;

    expect(component.canConvertToMilestone(task)).toBe(false);
    expect(component.canSaveTaskEdit()).toBe(false);
  });

  it('uses the task color for the round completion indicator', () => {
    component.tasks.set([{ ...task, status: 'complete', color: '#336699' }]);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector(
      '.task-status',
    ) as HTMLButtonElement;
    expect(indicator.style.getPropertyValue('--task-color')).toBe('#336699');
    expect(indicator.textContent?.trim()).toBe('✓');
    expect(indicator.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the round indicator between complete and not started', () => {
    component.groupChangeMode.set(false);
    const subtask: Task = {
      ...task,
      id: 'subtask-1',
      parentTaskId: task.id,
      name: 'Subtask',
      status: 'not_started',
      progress: 0,
    };
    component.tasks.set([task, subtask]);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector(
      '.task-status',
    ) as HTMLButtonElement;
    indicator.click();
    fixture.detectChanges();

    expect(updateTask).toHaveBeenNthCalledWith(1, task.id, {
      status: 'complete',
      progress: 100,
    });
    expect(component.tasks()[0].status).toBe('complete');
    expect(component.tasks()[0].progress).toBe(100);
    expect(component.tasks()[1].status).toBe('complete');
    expect(component.tasks()[1].progress).toBe(100);

    (fixture.nativeElement.querySelector('.task-status') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateTask).toHaveBeenNthCalledWith(2, task.id, {
      status: 'not_started',
      progress: 0,
    });
    expect(component.tasks()[0].status).toBe('not_started');
    expect(component.tasks()[0].progress).toBe(0);
    expect(component.tasks()[1].status).toBe('complete');
  });

  it('uses the project color when a task has no valid saved color', () => {
    component.groupChangeMode.set(false);
    component.tasks.set([{ ...task, color: '' }]);

    component.startEditingTask({ ...task, color: '' });

    expect(component.editedTaskColor).toBe(project.color);
    expect(component.canSaveTaskEdit()).toBe(true);
    expect(component.taskColorForDisplay({ ...task, color: '' })).toBe(
      project.color,
    );
  });

  it('does not cascade a subtask color change to its siblings', () => {
    component.groupChangeMode.set(false);
    const subtask: Task = {
      ...task,
      id: 'subtask-1',
      parentTaskId: task.id,
      name: 'Subtask',
      color: '#336699',
    };
    const sibling: Task = {
      ...subtask,
      id: 'subtask-2',
      name: 'Sibling subtask',
      color: '#993366',
    };
    component.tasks.set([task, subtask, sibling]);
    component.startEditingTask(subtask);
    component.editedTaskColor = '#669933';

    component.saveTaskEdit();

    expect(component.tasks().find((item) => item.id === subtask.id)?.color).toBe(
      '#669933',
    );
    expect(component.tasks().find((item) => item.id === sibling.id)?.color).toBe(
      '#993366',
    );
  });

  it('saves non-date edits without requiring unchanged dates to be rescheduled', () => {
    component.groupChangeMode.set(false);
    component.tasks.set([
      task,
      {
        ...task,
        id: 'subtask-1',
        parentTaskId: task.id,
        startDate: '2025-12-31',
        dueDate: '2026-01-02',
      },
    ]);
    component.startEditingTask(task);
    component.editedTaskName = 'Renamed task';

    expect(component.canSaveTaskEdit()).toBe(true);
    component.saveTaskEdit();

    expect(updateTask).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ name: 'Renamed task' }),
    );
    expect(updateTask.mock.calls[0][1]).not.toHaveProperty('startDate');
    expect(updateTask.mock.calls[0][1]).not.toHaveProperty('dueDate');
  });

  it('preserves progress when setting selected tasks to in progress', async () => {
    component.groupStatus = 'in_progress';

    component.applyGroupStatus();
    await Promise.resolve();

    expect(updateTask).toHaveBeenCalledWith(task.id, { status: 'in_progress' });
    expect(component.tasks()[0].progress).toBe(task.progress);
  });
});
