import { createApp } from './app';
import { connectDatabase, sequelize } from './config/database';
import { env } from './config/env';
import './models';
import { seedDemoProjectIfEmpty } from './models/seed';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  if (env.nodeEnv === 'development') {
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
        void sequelize.close().then(() => process.exit(0));
      });
    });
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start ManageIt API:', error);
  process.exit(1);
});
