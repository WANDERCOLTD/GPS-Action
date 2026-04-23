/**
 * Ping service — hello-world to prove the service layer works.
 * Remove once a real service exists.
 */

import { prisma } from '@/server/db/client';

export async function createPing(message: string) {
  return prisma.ping.create({
    data: { message },
  });
}

export async function listPings() {
  return prisma.ping.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}
