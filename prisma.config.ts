import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prefer DIRECT_URL for migrate/CLI operations (Neon/Supabase pooled
// endpoints route through PgBouncer which can't hold the session-level
// pg_advisory_lock that `prisma migrate deploy` needs). At runtime the
// app's adapter still uses DATABASE_URL (pooled) — see server/db/client.ts.
// Falls back to DATABASE_URL when DIRECT_URL isn't set (local dev).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    'prisma.config.ts: neither DIRECT_URL nor DATABASE_URL is set. ' +
      'Set DATABASE_URL for local dev, or both DATABASE_URL (pooled) + ' +
      'DIRECT_URL (non-pooled) on Vercel for serverless Postgres.',
  );
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: migrationUrl,
  },
});
