import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:4201',
  manageitJwtSecret: required(
    'MANAGEIT_JWT_SECRET',
    process.env.NODE_ENV === 'production'
      ? undefined
      : 'manageit-local-development-secret-change-before-deployment',
  ),
  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT ?? 5432),
    name: required('DB_NAME', 'manageit'),
    user: required('DB_USER', 'postgres'),
    password: required('DB_PASSWORD', 'postgres'),
    logging: process.env.DB_LOGGING === 'true',
  },
  clockedinDb: {
    host: process.env.CLOCKEDIN_DB_HOST ?? required('DB_HOST', 'localhost'),
    port: Number(process.env.CLOCKEDIN_DB_PORT ?? process.env.DB_PORT ?? 5432),
    name: required('CLOCKEDIN_DB_NAME', 'clockify_dupe'),
    user: process.env.CLOCKEDIN_DB_USER ?? required('DB_USER', 'postgres'),
    password:
      process.env.CLOCKEDIN_DB_PASSWORD ?? required('DB_PASSWORD', 'postgres'),
  },
};
