import { Project } from './Project';
import { Task } from './Task';

Project.hasMany(Task, {
  as: 'tasks',
  foreignKey: 'projectId',
  onDelete: 'CASCADE',
});
Task.belongsTo(Project, {
  as: 'project',
  foreignKey: 'projectId',
});

export { Project, Task };
