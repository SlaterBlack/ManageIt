import { Project, Task } from './index';

function offsetDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function seedDemoProjectIfEmpty(): Promise<void> {
  if ((await Project.count()) > 0) {
    return;
  }

  const project = await Project.create({
    projectCode: '001',
    name: 'Website Relaunch',
    description: 'A shared plan for the upcoming website launch.',
  });

  await Task.bulkCreate([
    {
      projectId: project.id,
      name: 'Confirm project scope',
      assignee: 'Alex',
      startDate: offsetDate(-2),
      dueDate: offsetDate(2),
      progress: 50,
      status: 'in_progress',
    },
    {
      projectId: project.id,
      name: 'Prepare page designs',
      assignee: 'Morgan',
      startDate: offsetDate(1),
      dueDate: offsetDate(7),
    },
    {
      projectId: project.id,
      name: 'Review launch checklist',
      assignee: '',
      startDate: offsetDate(5),
      dueDate: offsetDate(10),
    },
  ]);
}
