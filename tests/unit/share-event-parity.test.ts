/**
 * @build-unit bu-share-event-polymorphic
 * @spec build/session-briefs/bu-share-event-polymorphic.md
 * @adr docs/adrs/0018-share-event-polymorphic.md
 *
 * Smoke tests for the parity-check logic that gates Phase A and Phase B
 * of the ShareEvent migration. Mocks the count + existence probes so the
 * pure decision function is testable without a DB.
 */

import { describe, it, expect, vi } from 'vitest';
import { verifyShareEventParity } from '../../scripts/verify-share-event-parity';

type Deps = Parameters<typeof verifyShareEventParity>[0];

function deps(overrides: Partial<Deps>): Deps {
  return {
    postShareTableExists: vi.fn().mockResolvedValue(true),
    countPostShare: vi.fn().mockResolvedValue(0),
    countShareEventOfPostTarget: vi.fn().mockResolvedValue(0),
    countOrphanPostShareRows: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('verifyShareEventParity', () => {
  it('returns ok=true with vacuous-parity reason when PostShare does not exist', async () => {
    const result = await verifyShareEventParity(
      deps({ postShareTableExists: vi.fn().mockResolvedValue(false) }),
    );

    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/vacuously at parity/i);
  });

  it('does NOT call the count probes when PostShare is missing', async () => {
    const countPostShare = vi.fn().mockResolvedValue(0);
    const countShareEventOfPostTarget = vi.fn().mockResolvedValue(0);
    const countOrphanPostShareRows = vi.fn().mockResolvedValue(0);

    await verifyShareEventParity({
      postShareTableExists: vi.fn().mockResolvedValue(false),
      countPostShare,
      countShareEventOfPostTarget,
      countOrphanPostShareRows,
    });

    expect(countPostShare).not.toHaveBeenCalled();
    expect(countShareEventOfPostTarget).not.toHaveBeenCalled();
    expect(countOrphanPostShareRows).not.toHaveBeenCalled();
  });

  it('returns ok=true when counts match and no orphans', async () => {
    const result = await verifyShareEventParity(
      deps({
        countPostShare: vi.fn().mockResolvedValue(42),
        countShareEventOfPostTarget: vi.fn().mockResolvedValue(42),
        countOrphanPostShareRows: vi.fn().mockResolvedValue(0),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/parity ok/i);
    expect(result.details).toEqual({
      postShareCount: 42,
      shareEventPostCount: 42,
      orphanCount: 0,
    });
  });

  it('returns ok=false with count-mismatch reason when counts diverge', async () => {
    const result = await verifyShareEventParity(
      deps({
        countPostShare: vi.fn().mockResolvedValue(100),
        countShareEventOfPostTarget: vi.fn().mockResolvedValue(98),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/count mismatch/i);
    expect(result.reason).toContain('100');
    expect(result.reason).toContain('98');
  });

  it('returns ok=false with orphan reason when counts match but legacyPostShareId join is incomplete', async () => {
    const result = await verifyShareEventParity(
      deps({
        countPostShare: vi.fn().mockResolvedValue(10),
        countShareEventOfPostTarget: vi.fn().mockResolvedValue(10),
        countOrphanPostShareRows: vi.fn().mockResolvedValue(3),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/3 PostShare row\(s\) have no matching ShareEvent/i);
    expect(result.details?.orphanCount).toBe(3);
  });

  it('prioritises count-mismatch over orphan when both fail', async () => {
    const result = await verifyShareEventParity(
      deps({
        countPostShare: vi.fn().mockResolvedValue(100),
        countShareEventOfPostTarget: vi.fn().mockResolvedValue(50),
        countOrphanPostShareRows: vi.fn().mockResolvedValue(50),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/count mismatch/i);
  });
});
