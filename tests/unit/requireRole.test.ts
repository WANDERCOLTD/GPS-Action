/**
 * Unit tests for requireRole middleware and authedProcedure.
 *
 * @build-unit BU-001-lite
 * @spec architecture/admin-surface.md
 */

import { describe, it, expect } from 'vitest';
import { router, publicProcedure, requireRole, authedProcedure } from '@/server/lib/trpc';
import type { TRPCContext } from '@/server/lib/trpc';
import type { User } from '@prisma/client';
import { createCallerFactory } from '@/server/lib/trpc';
import { z } from 'zod';

// ── Test fixtures ──────────────────��─────────────────────────────────────

const fakeUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  phoneNumber: null,
  verifiedAt: new Date(),
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function makeCtx(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    user: null,
    activeRoles: [],
    activeScopes: [],
    ...overrides,
  };
}

// ── Test router ───────────��──────────────────────────────────────────────

const testRouter = router({
  adminOnly: publicProcedure
    .use(requireRole('admin'))
    .output(z.object({ ok: z.boolean() }))
    .query(() => ({ ok: true })),

  qmOnly: publicProcedure
    .use(requireRole('queue_manager'))
    .output(z.object({ ok: z.boolean() }))
    .query(() => ({ ok: true })),

  // D055 — scope-gated procedure
  vettingOnly: publicProcedure
    .use(requireRole('queue_manager:vetting'))
    .output(z.object({ ok: z.boolean() }))
    .query(() => ({ ok: true })),

  authedOnly: authedProcedure.output(z.object({ ok: z.boolean() })).query(() => ({ ok: true })),
});

const createCaller = createCallerFactory(testRouter);

// ── Tests ──────────���─────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  it('rejects anonymous users with UNAUTHORIZED', async () => {
    const caller = createCaller(makeCtx({ user: null }));
    await expect(caller.adminOnly()).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejects users without the required role with FORBIDDEN', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: [], activeScopes: [] }));
    await expect(caller.adminOnly()).rejects.toThrow('FORBIDDEN');
  });

  it('rejects queue_manager when admin is required', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: ['queue_manager'] }));
    await expect(caller.adminOnly()).rejects.toThrow('FORBIDDEN');
  });

  it('allows admin when admin is required', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: ['admin'] }));
    const result = await caller.adminOnly();
    expect(result).toEqual({ ok: true });
  });

  it('allows queue_manager when queue_manager is required', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: ['queue_manager'] }));
    const result = await caller.qmOnly();
    expect(result).toEqual({ ok: true });
  });

  it('allows users with multiple roles', async () => {
    const caller = createCaller(
      makeCtx({ user: fakeUser, activeRoles: ['admin', 'queue_manager'] }),
    );
    const adminResult = await caller.adminOnly();
    const qmResult = await caller.qmOnly();
    expect(adminResult).toEqual({ ok: true });
    expect(qmResult).toEqual({ ok: true });
  });
});

describe('requireRole — scope strings (D055)', () => {
  it('rejects users with no role and no scope', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser }));
    await expect(caller.vettingOnly()).rejects.toThrow('FORBIDDEN');
  });

  it('rejects users with the wrong scope (e.g. flag scope when vetting required)', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeScopes: ['queue_manager:flag'] }));
    await expect(caller.vettingOnly()).rejects.toThrow('FORBIDDEN');
  });

  it('allows users with the exact matching scope', async () => {
    const caller = createCaller(
      makeCtx({ user: fakeUser, activeScopes: ['queue_manager:vetting'] }),
    );
    const result = await caller.vettingOnly();
    expect(result).toEqual({ ok: true });
  });

  it('allows users with the unscoped role (broad grant satisfies any scope)', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: ['queue_manager'] }));
    const result = await caller.vettingOnly();
    expect(result).toEqual({ ok: true });
  });
});

describe('authedProcedure', () => {
  it('rejects anonymous users with UNAUTHORIZED', async () => {
    const caller = createCaller(makeCtx({ user: null }));
    await expect(caller.authedOnly()).rejects.toThrow('UNAUTHORIZED');
  });

  it('allows any authenticated user regardless of roles', async () => {
    const caller = createCaller(makeCtx({ user: fakeUser, activeRoles: [], activeScopes: [] }));
    const result = await caller.authedOnly();
    expect(result).toEqual({ ok: true });
  });
});
