import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.db.logging,
  define: {
    underscored: true,
  },
});

export const clockedinAccountsDatabase = new Sequelize(
  env.clockedinDb.name,
  env.clockedinDb.user,
  env.clockedinDb.password,
  {
    host: env.clockedinDb.host,
    port: env.clockedinDb.port,
    dialect: 'postgres',
    logging: false,
    pool: { max: 3, min: 0, acquire: 10_000, idle: 10_000 },
  },
);

export async function connectDatabases(): Promise<void> {
  await sequelize.authenticate();
  await clockedinAccountsDatabase.authenticate();
}
