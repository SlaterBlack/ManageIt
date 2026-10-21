import { Router } from 'express';
import { clockedinAccountsDatabase, sequelize } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await Promise.all([
      sequelize.authenticate(),
      clockedinAccountsDatabase.authenticate(),
    ]);
    res.json({
      status: 'ok',
      database: 'connected',
      accountsDatabase: 'connected',
    });
  }),
);
router.use('/auth', authRoutes);
router.use(requireAuth);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);

export default router;
