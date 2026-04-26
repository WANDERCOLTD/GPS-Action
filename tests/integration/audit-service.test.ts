/**
 * Integration tests for the audit log service.
 *
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 * @spec architecture/decision-log.md (B07)
 *
 * Tests the auditLog() function's contract: correct shape written,
 * null actor handled, and failures don't throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('@/server/db/client', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { auditLog } from '@/server/services/audit';
import { prisma } from '@/server/db/client';

const mockCreate = vi.mocked(prisma.auditLog.create);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auditLog', () => {
  it('writes an entry with the correct shape', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'audit-1',
      action: 'user_logged_in',
      entityType: 'User',
      entityId: 'user-1',
      userId: 'user-1',
      targetUserId: null,
      changes: null,
      context: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    });

    await auditLog({
      action: 'user_logged_in',
      entityType: 'User',
      entityId: 'user-1',
      userId: 'user-1',
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'user_logged_in',
        entityType: 'User',
        entityId: 'user-1',
        userId: 'user-1',
        targetUserId: null,
        changes: undefined,
        context: undefined,
        ipAddress: null,
        userAgent: null,
      },
    });
  });

  it('handles null actor (system-generated events)', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'audit-2',
      action: 'claim_ttl_expired',
      entityType: 'Request',
      entityId: 'wi-1',
      userId: null,
      targetUserId: null,
      changes: null,
      context: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    });

    await auditLog({
      action: 'claim_ttl_expired',
      entityType: 'Request',
      entityId: 'wi-1',
      userId: null,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
        }),
      }),
    );
  });

  it('stores changes and context as JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'audit-3',
      action: 'role_granted',
      entityType: 'RoleGrant',
      entityId: 'grant-1',
      userId: 'admin-1',
      targetUserId: 'user-1',
      changes: { role: 'queue_manager' },
      context: { reason: 'Volunteered for moderation' },
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    });

    await auditLog({
      action: 'role_granted',
      entityType: 'RoleGrant',
      entityId: 'grant-1',
      userId: 'admin-1',
      targetUserId: 'user-1',
      changes: { role: 'queue_manager' },
      context: { reason: 'Volunteered for moderation' },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changes: { role: 'queue_manager' },
          context: { reason: 'Volunteered for moderation' },
          targetUserId: 'user-1',
        }),
      }),
    );
  });

  it('does not throw when the database write fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));

    // Should complete without throwing
    await expect(
      auditLog({
        action: 'user_logged_in',
        entityType: 'User',
        entityId: 'user-1',
        userId: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[audit] write failed',
      expect.objectContaining({
        action: 'user_logged_in',
        error: 'DB connection lost',
      }),
    );

    consoleSpy.mockRestore();
  });
});
