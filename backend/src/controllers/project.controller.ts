import { Request, Response } from 'express';
import { Project, Task } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

function validateName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${label} is required.`);
  }
  const name = value.trim();
  if (name.length > 120) {
    throw new ApiError(400, `${label} must be 120 characters or fewer.`);
  }
  return name;
}

export const listProjects = asyncHandler(async (_req: Request, res: Response) => {
  const projects = await Project.findAll({
    order: [
      ['createdAt', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  res.json({ projects });
});

export const createProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description = '' } = req.body as {
      name?: unknown;
      description?: unknown;
    };
    if (typeof description !== 'string') {
      throw new ApiError(400, 'Description must be a string.');
    }
    if (description.length > 2000) {
      throw new ApiError(400, 'Description must be 2000 characters or fewer.');
    }
    const project = await Project.create({
      name: validateName(name, 'Project name'),
      description: description.trim(),
    });
    res.status(201).json({ project });
  },
);

export const updateProject = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      throw new ApiError(404, 'Project not found.');
    }

    const { name, description } = req.body as {
      name?: unknown;
      description?: unknown;
    };
    if (name === undefined && description === undefined) {
      throw new ApiError(400, 'At least one project field must be provided.');
    }
    const updates: { name?: string; description?: string } = {};
    if (name !== undefined) {
      updates.name = validateName(name, 'Project name');
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 2000) {
        throw new ApiError(400, 'Description must be 2000 characters or fewer.');
      }
      updates.description = description.trim();
    }
    await project.update(updates);
    res.json({ project });
  },
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      throw new ApiError(404, 'Project not found.');
    }
    await project.destroy();
    res.status(204).send();
  },
);

export const listProjectTasks = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await Project.findByPk(req.params.projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found.');
    }
    const tasks = await Task.findAll({
      where: { projectId: project.id },
      order: [
        ['startDate', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    res.json({ tasks });
  },
);
