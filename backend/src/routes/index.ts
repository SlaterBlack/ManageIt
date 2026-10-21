import { Router } from 'express';
import { sequelize } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await sequelize.authenticate();
    res.json({ status: 'ok', database: 'connected' });
  }),
);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);

export default router;
