/**
 * Prisma client — singleton.
 * Next.js hot-reload friendly (attaches to global in dev).
 *
 * Prisma 7 removed `datasource.url` from schema (D0NN). Connection URL now
 * lives in `prisma.config.ts` for the Migrate CLI, and runtime is wired via
 * `@prisma/adapter-pg` here.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  var prismaClient: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}
