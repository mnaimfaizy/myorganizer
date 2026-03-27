import dotenv from 'dotenv';
import path from 'path';
import { defineConfig, env } from 'prisma/config';

// Load .env from monorepo root so Prisma CLI commands
// (run from apps/backend/src/) can resolve DATABASE_URL.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

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
