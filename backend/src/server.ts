import { createApp } from './app';
import {
  clockedinAccountsDatabase,
  connectDatabases,
  sequelize,
} from './config/database';
import { env } from './config/env';
import './models';
import { migrateProjectMetadata } from './models/projectMetadataMigration';
import { seedDemoProjectIfEmpty } from './models/seed';

async function bootstrap(): Promise<void> {
  await connectDatabases();
  if (env.nodeEnv === 'development') {
    await migrateProjectMetadata();
    await sequelize.sync({ alter: true });
    await seedDemoProjectIfEmpty();
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`ManageIt API listening on http://localhost:${env.port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => {
        void Promise.all([
          sequelize.close(),
          clockedinAccountsDatabase.close(),
        ])
          .then(() => process.exit(0))
          .catch((error: unknown) => {
            console.error('Failed to close database connections:', error);
            process.exit(1);
          });
      });
    });
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start ManageIt API:', error);
  process.exit(1);
});
