import { Project } from './Project';
import { Task } from './Task';
import { TaskDependency } from './TaskDependency';

Project.hasMany(Task, {
  as: 'tasks',
  foreignKey: 'projectId',
  onDelete: 'CASCADE',
});
Task.belongsTo(Project, {
  as: 'project',
  foreignKey: 'projectId',
});

Task.hasMany(Task, {
  as: 'subtasks',
  foreignKey: 'parentTaskId',
  onDelete: 'CASCADE',
});
Task.belongsTo(Task, {
  as: 'parentTask',
  foreignKey: 'parentTaskId',
});

Project.hasMany(TaskDependency, {
  as: 'dependencies',
  foreignKey: 'projectId',
  onDelete: 'CASCADE',
});
TaskDependency.belongsTo(Project, {
  as: 'project',
  foreignKey: 'projectId',
});
Task.hasMany(TaskDependency, {
  as: 'outgoingDependencies',
  foreignKey: 'predecessorTaskId',
  onDelete: 'CASCADE',
});
Task.hasMany(TaskDependency, {
  as: 'incomingDependencies',
  foreignKey: 'successorTaskId',
  onDelete: 'CASCADE',
});
TaskDependency.belongsTo(Task, {
  as: 'predecessor',
  foreignKey: 'predecessorTaskId',
});
TaskDependency.belongsTo(Task, {
  as: 'successor',
  foreignKey: 'successorTaskId',
});

export { Project, Task, TaskDependency };
