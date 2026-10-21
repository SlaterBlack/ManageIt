import { Router } from 'express';
import {
  deleteTask,
  updateTask,
} from '../controllers/task.controller';

const router = Router();

router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

export default router;
