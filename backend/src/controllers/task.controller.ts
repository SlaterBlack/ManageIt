import { Request, Response } from 'express';
import { Project, Task } from '../models';
import { TASK_STATUSES, TaskStatus } from '../models/Task';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

function validateDate(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new ApiError(400, `${label} must be a valid YYYY-MM-DD date.`);
  }
  return value;
}

function validateProgress(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new ApiError(400, 'Progress must be an integer from 0 to 100.');
  }
  return value;
}

function validateStatus(value: unknown): TaskStatus {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value as TaskStatus)) {
    throw new ApiError(
      400,
      `Status must be one of: ${TASK_STATUSES.join(', ')}.`,
    );
  }
  return value as TaskStatus;
}

function validateTaskName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'Task name is required.');
  }
  const name = value.trim();
  if (name.length > 120) {
    throw new ApiError(400, 'Task name must be 120 characters or fewer.');
  }
  return name;
}

export const createProjectTask = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await Project.findByPk(req.params.projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found.');
    }
    const { name, assignee = '', startDate, dueDate } = req.body as {
      name?: unknown;
      assignee?: unknown;
      startDate?: unknown;
      dueDate?: unknown;
    };
    if (typeof assignee !== 'string' || assignee.length > 120) {
      throw new ApiError(400, 'Assignee must be 120 characters or fewer.');
    }
    const validStart = validateDate(startDate, 'Start date');
    const validDue = validateDate(dueDate, 'Due date');
    if (validDue < validStart) {
      throw new ApiError(400, 'Due date must be on or after the start date.');
    }
    const task = await Task.create({
      projectId: project.id,
      name: validateTaskName(name),
      assignee: assignee.trim(),
      startDate: validStart,
      dueDate: validDue,
    });
    res.status(201).json({ task });
  },
);

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findByPk(req.params.taskId);
  if (!task) {
    throw new ApiError(404, 'Task not found.');
  }
  const { name, assignee, startDate, dueDate, progress, status } = req.body as {
    name?: unknown;
    assignee?: unknown;
    startDate?: unknown;
    dueDate?: unknown;
    progress?: unknown;
    status?: unknown;
  };
  if (
    name === undefined &&
    assignee === undefined &&
    startDate === undefined &&
    dueDate === undefined &&
    progress === undefined &&
    status === undefined
  ) {
    throw new ApiError(400, 'Provide at least one task field to update.');
  }

  const updates: {
    name?: string;
    assignee?: string;
    startDate?: string;
    dueDate?: string;
    progress?: number;
    status?: TaskStatus;
  } = {};
  if (name !== undefined) {
    updates.name = validateTaskName(name);
  }
  if (assignee !== undefined) {
    if (typeof assignee !== 'string' || assignee.length > 120) {
      throw new ApiError(400, 'Assignee must be 120 characters or fewer.');
    }
    updates.assignee = assignee.trim();
  }
  if (startDate !== undefined) {
    updates.startDate = validateDate(startDate, 'Start date');
  }
  if (dueDate !== undefined) {
    updates.dueDate = validateDate(dueDate, 'Due date');
  }
  if (progress !== undefined) {
    updates.progress = validateProgress(progress);
  }
  if (status !== undefined) {
    updates.status = validateStatus(status);
  }
  const resultingStart = updates.startDate ?? task.startDate;
  const resultingDue = updates.dueDate ?? task.dueDate;
  if (resultingDue < resultingStart) {
    throw new ApiError(400, 'Due date must be on or after the start date.');
  }

  await task.update(updates);
  res.json({ task });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findByPk(req.params.taskId);
  if (!task) {
    throw new ApiError(404, 'Task not found.');
  }
  await task.destroy();
  res.status(204).send();
});
