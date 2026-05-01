import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prefer DIRECT_URL for migrate/CLI operations (Neon/Supabase pooled
// endpoints route through PgBouncer which can't hold the session-level
// pg_advisory_lock that `prisma migrate deploy` needs). At runtime the
// app's adapter still uses DATABASE_URL (pooled) — see server/db/client.ts.
// Falls back to DATABASE_URL when DIRECT_URL isn't set (local dev).
//
// Don't throw when both are absent: `prisma generate` (postinstall hook)
// doesn't need a connection, and CI's `npm ci` runs the postinstall
// before any env vars are loaded. Pass through an empty string; Prisma
// itself will fail loudly when a command that actually needs a
// connection (migrate, db push, etc.) runs without one.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: migrationUrl,
  },
});
