import { DataTypes, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

export async function migrateTaskStructure(): Promise<void> {
  const tables = await sequelize.query<{ tableExists: boolean }>(
    "SELECT to_regclass('public.tasks') IS NOT NULL AS \"tableExists\"",
    { type: QueryTypes.SELECT },
  );
  if (!tables[0]?.tableExists) {
    return;
  }

  const queryInterface = sequelize.getQueryInterface();
  const taskColumns = await queryInterface.describeTable('tasks');
  if (!taskColumns.parent_task_id) {
    await queryInterface.addColumn('tasks', 'parent_task_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'tasks', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }

  const taskIndexes = await sequelize.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'tasks'`,
    { type: QueryTypes.SELECT },
  );
  if (!taskIndexes.some((index) => index.indexname === 'tasks_parent_task_id_idx')) {
    await queryInterface.addIndex('tasks', ['parent_task_id'], {
      name: 'tasks_parent_task_id_idx',
    });
  }

  const dependencyTables = await sequelize.query<{ tableExists: boolean }>(
    "SELECT to_regclass('public.task_dependencies') IS NOT NULL AS \"tableExists\"",
    { type: QueryTypes.SELECT },
  );
  if (!dependencyTables[0]?.tableExists) {
    await queryInterface.createTable('task_dependencies', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      predecessor_task_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      successor_task_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
  }

  const dependencyIndexes = await sequelize.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'task_dependencies'`,
    { type: QueryTypes.SELECT },
  );
  if (
    !dependencyIndexes.some(
      (index) => index.indexname === 'task_dependencies_project_pair_unique',
    )
  ) {
    await queryInterface.addIndex(
      'task_dependencies',
      ['project_id', 'predecessor_task_id', 'successor_task_id'],
      { name: 'task_dependencies_project_pair_unique', unique: true },
    );
  }

  for (const [field, indexName] of [
    ['predecessor_task_id', 'task_dependencies_predecessor_task_id_idx'],
    ['successor_task_id', 'task_dependencies_successor_task_id_idx'],
  ] as const) {
    if (!dependencyIndexes.some((index) => index.indexname === indexName)) {
      await queryInterface.addIndex('task_dependencies', [field], {
        name: indexName,
      });
    }
  }

  const dependencyConstraints = await sequelize.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.task_dependencies'::regclass`,
    { type: QueryTypes.SELECT },
  );
  if (
    !dependencyConstraints.some(
      (constraint) => constraint.conname === 'task_dependencies_no_self_link',
    )
  ) {
    await sequelize.query(
      `ALTER TABLE public.task_dependencies
      ADD CONSTRAINT task_dependencies_no_self_link
      CHECK (predecessor_task_id <> successor_task_id)`,
    );
  }
}
