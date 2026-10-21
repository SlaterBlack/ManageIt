import { Router } from 'express';
import {
  createProject,
  deleteProject,
  listProjectTasks,
  listProjects,
  updateProject,
} from '../controllers/project.controller';
import {
  createProjectDependency,
  deleteProjectDependency,
  listProjectDependencies,
} from '../controllers/dependency.controller';
import { createProjectTask } from '../controllers/task.controller';

const router = Router();

router.get('/', listProjects);
router.post('/', createProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.get('/:projectId/dependencies', listProjectDependencies);
router.post('/:projectId/dependencies', createProjectDependency);
router.delete('/:projectId/dependencies/:dependencyId', deleteProjectDependency);
router.get('/:projectId/tasks', listProjectTasks);
router.post('/:projectId/tasks', createProjectTask);

export default router;
