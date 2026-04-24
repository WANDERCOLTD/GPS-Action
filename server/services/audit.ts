/**
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/decision-log.md (B07)
 *
 * Immutable, append-only audit log writer. Every mutation in the
 * system should call this. Never throws — audit failures log to
 * console but don't block the caller.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

export async function auditLog(entry: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  targetUserId?: string | null;
  changes?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId ?? null,
        targetUserId: entry.targetUserId ?? null,
        changes: entry.changes ? (entry.changes as Prisma.InputJsonValue) : undefined,
        context: entry.context ? (entry.context as Prisma.InputJsonValue) : undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err: unknown) {
    // Audit log must NEVER block a mutation. Log and move on.
    console.error('[audit] write failed', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
