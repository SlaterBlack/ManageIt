import { DataTypes, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { DEFAULT_PROJECT_COLOR } from './Project';

interface ExistingProject {
  id: string;
  project_code: string | null;
}

export async function migrateProjectMetadata(): Promise<void> {
  const tableRows = await sequelize.query<{ tableExists: boolean }>(
    "SELECT to_regclass('public.projects') IS NOT NULL AS \"tableExists\"",
    { type: QueryTypes.SELECT },
  );
  if (!tableRows[0]?.tableExists) {
    return;
  }

  const queryInterface = sequelize.getQueryInterface();
  let columns = await queryInterface.describeTable('projects');
  if (!columns.project_code) {
    await queryInterface.addColumn('projects', 'project_code', {
      type: DataTypes.STRING(3),
      allowNull: true,
    });
  }
  if (!columns.color) {
    await queryInterface.addColumn('projects', 'color', {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: DEFAULT_PROJECT_COLOR,
    });
  }

  columns = await queryInterface.describeTable('projects');
  if (!columns.project_code || !columns.color) {
    throw new Error('Could not add project code and color columns.');
  }

  const projects = await sequelize.query<ExistingProject>(
    'SELECT "id", "project_code" FROM "projects" ORDER BY "id"',
    { type: QueryTypes.SELECT },
  );
  const usedCodes = new Set<string>();
  for (const project of projects) {
    if (project.project_code === null) {
      continue;
    }
    if (!/^\d{3}$/.test(project.project_code)) {
      throw new Error(`Project ${project.id} has an invalid project code.`);
    }
    if (usedCodes.has(project.project_code)) {
      throw new Error(`Project code ${project.project_code} is already in use.`);
    }
    usedCodes.add(project.project_code);
  }

  let nextCode = 0;
  for (const project of projects) {
    if (project.project_code !== null) {
      continue;
    }
    while (
      nextCode <= 999 &&
      usedCodes.has(String(nextCode).padStart(3, '0'))
    ) {
      nextCode += 1;
    }
    if (nextCode > 999) {
      throw new Error('Could not assign a unique three-digit code to every project.');
    }

    const projectCode = String(nextCode).padStart(3, '0');
    await sequelize.query(
      'UPDATE "projects" SET "project_code" = :projectCode WHERE "id" = :id',
      { replacements: { projectCode, id: project.id } },
    );
    usedCodes.add(projectCode);
    nextCode += 1;
  }

  await queryInterface.changeColumn('projects', 'project_code', {
    type: DataTypes.STRING(3),
    allowNull: false,
  });

  const indexes = await sequelize.query<{ indexname: string }>(
    `SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'projects'`,
    { type: QueryTypes.SELECT },
  );
  if (!indexes.some((index) => index.indexname === 'projects_project_code_unique')) {
    await queryInterface.addIndex('projects', ['project_code'], {
      name: 'projects_project_code_unique',
      unique: true,
    });
  }
}
