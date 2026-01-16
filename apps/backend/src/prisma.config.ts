import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  datasource: {
    url:
      process.env.NODE_ENV === 'production'
        ? env('DATABASE_URL')
        : (process.env.DATABASE_URL ??
          'postgresql://localhost:5432/myorganizer'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
