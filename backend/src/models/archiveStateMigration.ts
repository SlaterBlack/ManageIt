import { DataTypes, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

export async function migrateArchiveState(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  for (const table of ['projects', 'tasks'] as const) {
    const tables = await sequelize.query<{ tableExists: boolean }>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS "tableExists"`,
      { type: QueryTypes.SELECT },
    );
    if (!tables[0]?.tableExists) {
      continue;
    }

    const columns = await queryInterface.describeTable(table);
    if (!columns.is_archived) {
      await queryInterface.addColumn(table, 'is_archived', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  }
}
