/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Registry shape + lookup tests for the per-kind action registry.
 * Keeps the contract honest: known slugs return the action, unknown
 * slugs return `null` cleanly, the registry is read-only, and the
 * one Phase-1 entry has the expected metadata.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  POST_KIND_ACTION_REGISTRY,
  getPostKindAction,
  type PostForAction,
  type ActionContext,
} from '@/shared/post-kind-actions';

describe('POST_KIND_ACTION_REGISTRY', () => {
  it('registers exactly one Phase-1 action: share_to_gps_whatsapp', () => {
    expect(Object.keys(POST_KIND_ACTION_REGISTRY)).toEqual(['share_to_gps_whatsapp']);
  });

  it('exposes registry as a frozen object (no mutation)', () => {
    expect(Object.isFrozen(POST_KIND_ACTION_REGISTRY)).toBe(true);
  });

  it('share_to_gps_whatsapp action has the expected shape', () => {
    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    expect(action).toBeDefined();
    expect(action?.slug).toBe('share_to_gps_whatsapp');
    expect(action?.primary).toBe(true);
    expect(typeof action?.label).toBe('function');
    expect(typeof action?.handler).toBe('function');
    expect(action?.icon).toBeDefined();
  });

  it('share_to_gps_whatsapp label adapts to the post.signal', () => {
    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    const promotePost: PostForAction = {
      id: 'p1',
      title: 't',
      body: 'b',
      signal: 'promote',
    };
    const removePost: PostForAction = { ...promotePost, signal: 'remove' };
    expect(action?.label(promotePost)).toContain('✅');
    expect(action?.label(removePost)).toContain('❌');
  });
});

describe('getPostKindAction', () => {
  it('returns the registered action for a known slug', () => {
    const action = getPostKindAction('share_to_gps_whatsapp');
    expect(action).not.toBeNull();
    expect(action?.slug).toBe('share_to_gps_whatsapp');
  });

  it('returns null for unknown slugs (graceful forward-compat per D072 §4)', () => {
    expect(getPostKindAction('schedule_for_sundown')).toBeNull();
    expect(getPostKindAction('share_to_socials')).toBeNull();
    expect(getPostKindAction('not_a_real_slug')).toBeNull();
    expect(getPostKindAction('')).toBeNull();
  });
});

describe('shareToGpsWhatsappAction handler', () => {
  const basePost: PostForAction = {
    id: 'post-abc',
    title: 'Hostile op-ed',
    body: 'Please amplify the rebuttal thread.',
    signal: 'promote',
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when post.signal is null (tick_or_cross invariant)', async () => {
    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    const ctx: ActionContext = {
      originUrl: 'https://gps-action.example',
      channelUrl: 'https://wa.me/channel',
    };
    await expect(action!.handler({ ...basePost, signal: null }, ctx)).rejects.toThrow(
      /post.signal/,
    );
  });

  it('throws when channelUrl is missing', async () => {
    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    const ctx: ActionContext = { originUrl: 'https://gps-action.example' };
    await expect(action!.handler(basePost, ctx)).rejects.toThrow(/channelUrl/);
  });

  it('writes the formatted message to the clipboard and opens the channel URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('window', { open });

    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    await action!.handler(basePost, {
      originUrl: 'https://gps-action.example/',
      channelUrl: 'https://wa.me/channel',
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const message = writeText.mock.calls[0]?.[0] as string;
    expect(message).toContain('✅ Hostile op-ed');
    expect(message).toContain(basePost.body);
    expect(message).toContain('https://gps-action.example/post/post-abc');
    expect(open).toHaveBeenCalledWith('https://wa.me/channel', '_blank', 'noopener,noreferrer');
  });

  it('hands "Did you send it?" off to the modal via onConfirmStep', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal('window', { open: vi.fn() });

    const onConfirmStep = vi.fn();
    const onMarkSharedToNetwork = vi.fn().mockResolvedValue(undefined);

    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    await action!.handler(basePost, {
      originUrl: 'https://gps-action.example',
      channelUrl: 'https://wa.me/channel',
      onConfirmStep,
      onMarkSharedToNetwork,
    });

    expect(onConfirmStep).toHaveBeenCalledTimes(1);
    expect(onConfirmStep.mock.calls[0]?.[0]).toBe('Did you send it?');
    const onYes = onConfirmStep.mock.calls[0]?.[1] as () => Promise<void>;
    await onYes();
    expect(onMarkSharedToNetwork).toHaveBeenCalledWith('post-abc');
  });

  it('skips the confirm-step hand-off if either onConfirmStep or onMarkSharedToNetwork is missing', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal('window', { open: vi.fn() });

    const onConfirmStep = vi.fn();
    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    await action!.handler(basePost, {
      originUrl: 'https://gps-action.example',
      channelUrl: 'https://wa.me/channel',
      onConfirmStep,
      // onMarkSharedToNetwork omitted
    });
    expect(onConfirmStep).not.toHaveBeenCalled();
  });

  it('tolerates a clipboard write failure without throwing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('window', { open: vi.fn() });

    const action = POST_KIND_ACTION_REGISTRY.share_to_gps_whatsapp;
    await expect(
      action!.handler(basePost, {
        originUrl: 'https://gps-action.example',
        channelUrl: 'https://wa.me/channel',
      }),
    ).resolves.toBeUndefined();
  });
});
