/**
 * Unit tests for NetworkCard.
 *
 * @build-unit BU-network-feed
 * @spec adrs/0017-network-card-state.md
 *
 * Vitest env is `node` — no RTL. We invoke NetworkCard as a plain
 * function and walk the ReactElement tree to assert the contract:
 *
 *   - link target is the upstream URL with new-tab + rel=noopener
 *   - anonymous-member fallback when fromName is null, with
 *     `data-anon="true"` for the parent's clustering hook
 *   - triage controls render the three statuses + Reset (when not NEW)
 *   - onSetStatus is dispatched with the right value when a button
 *     is invoked (no React rendering — calls the onClick handler
 *     directly to keep the test env-agnostic)
 *   - card refuses to dispatch a triage call while pending
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement, MouseEvent } from 'react';
import { NetworkCard } from '@/components/NetworkCard';
import type { SerializedNetworkCard } from '@/shared/network-card';
import { emptyNetworkCardShareCounts } from '@/shared/network-card';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    const c = e.props.children;
    if (Array.isArray(c)) c.forEach(walk);
    else walk(c);
  };
  walk(el);
  return acc;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

function makeCard(overrides: Partial<SerializedNetworkCard> = {}): SerializedNetworkCard {
  return {
    messageId: '42',
    sentAt: '2026-05-09T12:00:00.000Z',
    url: 'https://example.com/article',
    linkTitle: 'A useful article',
    textBody: 'Worth a read',
    fromName: 'Sharon',
    senderHash: 'hash-sharon',
    chatId: 'gps-network@g.us',
    state: {
      status: 'NEW',
      ownerUserId: null,
      ownerDisplayName: null,
      notes: null,
      updatedAt: null,
    },
    linkPreview: null,
    shareCounts: emptyNetworkCardShareCounts(),
    source: {
      slug: 'gps-action-network',
      label: 'GPS Action Network!',
      description: null,
      displayOrder: 1,
      color: '#3fb950',
      icon: '🎯',
      memberCount: 190,
    },
    isForwarded: false,
    ...overrides,
  };
}

function fakeMouseEvent(): MouseEvent<HTMLButtonElement> {
  return { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
}

describe('NetworkCard', () => {
  it('renders the link title with the URL as click target, new tab, noopener', () => {
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const link = findByTestId(tree, 'network-card-link');
    expect(link).toBeDefined();
    expect(link?.props.href).toBe('https://example.com/article');
    expect(link?.props.target).toBe('_blank');
    expect(link?.props.rel).toBe('noopener noreferrer');
  });

  it('falls back to URL hostname when linkTitle is null', () => {
    const tree = NetworkCard({
      card: makeCard({ linkTitle: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const link = findByTestId(tree, 'network-card-link');
    const text = link?.props.children;
    expect(text).toBe('example.com');
  });

  it('renders "anonymous member" when fromName is null and tags data-anon', () => {
    const tree = NetworkCard({
      card: makeCard({ fromName: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(tree.props['data-anon']).toBe('true');
    const sender = findByTestId(tree, 'network-card-sender');
    expect(sender?.props.children).toBe('anonymous member');
  });

  it('renders the source label from card.source (not a hard-coded string)', () => {
    const tree = NetworkCard({
      card: makeCard({
        source: {
          slug: 'hendon-jag',
          label: 'Hendon JAG',
          description: null,
          displayOrder: 2,
          color: '#dc2626',
          icon: '🚩',
          memberCount: 80,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const group = findByTestId(tree, 'network-card-group');
    expect(group).toBeDefined();
    expect(group?.props['data-source-slug']).toBe('hendon-jag');
    // The label text is one of the children (alongside the dot + icon spans).
    const childArray = Array.isArray(group?.props.children)
      ? group?.props.children
      : [group?.props.children];
    expect(childArray.includes('Hendon JAG')).toBe(true);
  });

  it('renders the forwarded badge when isForwarded is true', () => {
    const tree = NetworkCard({
      card: makeCard({ isForwarded: true }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-forwarded-badge')).toBeDefined();
  });

  it('omits the forwarded badge when isForwarded is false', () => {
    const tree = NetworkCard({
      card: makeCard({ isForwarded: false }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-forwarded-badge')).toBeUndefined();
  });

  it('omits the body row when textBody is null', () => {
    const tree = NetworkCard({
      card: makeCard({ textBody: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-body')).toBeUndefined();
  });

  it('renders Triaged / Promoted / Discarded buttons when status is NEW', () => {
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-triage-triaged')).toBeDefined();
    expect(findByTestId(tree, 'network-card-triage-promoted')).toBeDefined();
    expect(findByTestId(tree, 'network-card-triage-discarded')).toBeDefined();
    // No Reset button at NEW.
    expect(findByTestId(tree, 'network-card-triage-reset')).toBeUndefined();
  });

  it('shows the Reset button when status is non-NEW', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'TRIAGED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-triage-reset')).toBeDefined();
  });

  it('dispatches onSetStatus with the target status when a button is clicked', () => {
    const onSetStatus = vi.fn();
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus,
      pending: false,
    }) as AnyElement;

    const promote = findByTestId(tree, 'network-card-triage-promoted');
    expect(promote).toBeDefined();
    const onClick = promote?.props.onClick as (e: MouseEvent<HTMLButtonElement>) => void;
    onClick(fakeMouseEvent());
    expect(onSetStatus).toHaveBeenCalledWith('PROMOTED');
  });

  it('refuses to dispatch when pending: true', () => {
    const onSetStatus = vi.fn();
    const tree = NetworkCard({
      card: makeCard(),
      onSetStatus,
      pending: true,
    }) as AnyElement;

    const triage = findByTestId(tree, 'network-card-triage-triaged');
    const onClick = triage?.props.onClick as (e: MouseEvent<HTMLButtonElement>) => void;
    onClick(fakeMouseEvent());
    expect(onSetStatus).not.toHaveBeenCalled();
    expect(triage?.props.disabled).toBe(true);
  });

  it('marks the active triage button via background style when status matches', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'PROMOTED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const promoted = findByTestId(tree, 'network-card-triage-promoted');
    const triaged = findByTestId(tree, 'network-card-triage-triaged');
    const promotedBg = (promoted?.props.style as { background: string }).background;
    const triagedBg = (triaged?.props.style as { background: string }).background;
    expect(promotedBg).toBe('var(--colour-surface-sunken)');
    expect(triagedBg).toBe('transparent');
  });

  it('exposes the status on the article via data-status', () => {
    const tree = NetworkCard({
      card: makeCard({
        state: {
          status: 'DISCARDED',
          ownerUserId: null,
          ownerDisplayName: null,
          notes: null,
          updatedAt: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(tree.props['data-status']).toBe('DISCARDED');
  });

  it('omits the link-preview block when linkPreview is null', () => {
    const tree = NetworkCard({
      card: makeCard({ linkPreview: null }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    expect(findByTestId(tree, 'network-card-preview')).toBeUndefined();
    expect(tree.props['data-has-preview']).toBe('false');
    // Plain title link still rendered as the primary affordance.
    expect(findByTestId(tree, 'network-card-link')).toBeDefined();
  });

  it('renders the LinkPreviewCard hero block when linkPreview is set', () => {
    const tree = NetworkCard({
      card: makeCard({
        linkPreview: {
          title: 'Hero title from OG',
          description: 'OG description here',
          imageUrl: 'https://example.com/hero.jpg',
          siteName: 'Example',
          faviconUrl: null,
        },
      }),
      onSetStatus: vi.fn(),
      pending: false,
    }) as AnyElement;

    const wrapper = findByTestId(tree, 'network-card-preview');
    expect(wrapper).toBeDefined();
    expect(tree.props['data-has-preview']).toBe('true');
    // The plain title link is suppressed — the hero card replaces it
    // as the primary clickable surface (no double-link to same URL).
    expect(findByTestId(tree, 'network-card-link')).toBeUndefined();
  });

  // ── bu-network-unfurl-fixes ───────────────────────────────────────────

  describe('link preview size + favicon plumbing', () => {
    function previewProps(tree: AnyElement): Record<string, unknown> | undefined {
      const wrapper = findByTestId(tree, 'network-card-preview');
      const child = (wrapper?.props.children ?? null) as AnyElement | null;
      return child?.props as Record<string, unknown> | undefined;
    }

    it('passes size="large" to LinkPreviewCard for normal URLs', () => {
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://www.theguardian.com/uk-news/2026/may/01/example',
          linkPreview: {
            title: 'A title',
            description: null,
            imageUrl: 'https://example.com/hero.jpg',
            siteName: 'The Guardian',
            faviconUrl: 'https://www.theguardian.com/favicon.ico',
          },
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(previewProps(tree)?.size).toBe('large');
    });

    it('drops to size="small" for x.com URLs (avatar reads as thumbnail)', () => {
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://x.com/somebody/status/123',
          linkPreview: {
            title: 'A tweet',
            description: null,
            imageUrl: 'https://pbs.twimg.com/profile_images/avatar.jpg',
            siteName: 'X',
            faviconUrl: null,
          },
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(previewProps(tree)?.size).toBe('small');
    });

    it('drops to size="small" for twitter.com URLs', () => {
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://twitter.com/somebody/status/123',
          linkPreview: {
            title: null,
            description: null,
            imageUrl: 'https://pbs.twimg.com/profile_images/avatar.jpg',
            siteName: null,
            faviconUrl: null,
          },
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(previewProps(tree)?.size).toBe('small');
    });

    it('forwards faviconUrl from the preview to LinkPreviewCard', () => {
      const favicon = 'https://www.cufi.org.uk/favicon.ico';
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://www.cufi.org.uk/events/11feb2026/',
          linkPreview: {
            title: 'An event',
            description: null,
            imageUrl: null,
            siteName: 'CUFI',
            faviconUrl: favicon,
          },
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(previewProps(tree)?.linkFaviconUrl).toBe(favicon);
    });
  });

  it('passes the body through to ClampedCardBody (which owns overflowWrap)', () => {
    // bu-network-card-body-clamp: the body's overflowWrap +
    // line-clamp lives in ClampedCardBody. NetworkCard hands it the
    // body text + messageId + threshold; the clamp itself is hook-
    // driven and out of reach of this pure-function test harness.
    const longUrlBody =
      'See https://www.facebook.com/some.user/posts/pfbid0LongOpaqueTokenWithNoBreakOpportunitiesAtAll1234567890abcdef';
    const tree = NetworkCard({
      card: makeCard({ textBody: longUrlBody }),
      onSetStatus: vi.fn(),
      pending: false,
      bodyClampThresholdLines: 6,
    }) as AnyElement;

    const clampedBody = flatChildren(tree).find(
      (el) =>
        typeof el.type === 'function' && (el.type as { name?: string }).name === 'ClampedCardBody',
    );
    expect(clampedBody).toBeDefined();
    expect(clampedBody?.props.body).toBe(longUrlBody);
    expect(clampedBody?.props.thresholdLines).toBe(6);
  });

  // ── BU-network-reactions ──────────────────────────────────────────────

  describe('reactions', () => {
    it('does NOT render the reaction pill when no reaction callbacks are passed', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      expect(findByTestId(tree, 'network-card-reactions')).toBeUndefined();
    });

    it('renders the reaction pill wrapper when both add + remove callbacks are wired', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        reactions: [],
        onAddReaction: vi.fn().mockResolvedValue(undefined),
        onRemoveReaction: vi.fn().mockResolvedValue(undefined),
      }) as AnyElement;

      const wrapper = findByTestId(tree, 'network-card-reactions');
      expect(wrapper).toBeDefined();
      expect(wrapper?.props['data-message-id']).toBe('42');
    });

    it('passes the aggregate reactions array through to the pill', () => {
      const reactions = [{ emoji: 'heart' as const, count: 3, mine: true }];
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        reactions,
        onAddReaction: vi.fn().mockResolvedValue(undefined),
        onRemoveReaction: vi.fn().mockResolvedValue(undefined),
      }) as AnyElement;

      const wrapper = findByTestId(tree, 'network-card-reactions');
      expect(wrapper).toBeDefined();
      // The pill is the first child element of the wrapper. Walk its
      // props rather than render — vitest env is node, no RTL.
      const pill = (wrapper?.props.children ?? null) as AnyElement;
      expect(pill).toBeDefined();
      expect(pill.props.reactions).toEqual(reactions);
      expect(typeof pill.props.onAdd).toBe('function');
      expect(typeof pill.props.onRemove).toBe('function');
    });
  });

  // ── bu-network-shares ─────────────────────────────────────────────────
  //
  // These tests inspect the props passed to <ShareGroup> /
  // <WhatsAppShareTargetButton> rather than walking the rendered DOM —
  // NetworkCard is invoked as a function in this env, so child
  // components are not rendered. The contract under test is: NetworkCard
  // wires the right props into the share components.

  describe('share rail', () => {
    function shareColumnChildren(tree: AnyElement): AnyElement[] {
      const col = findByTestId(tree, 'network-card-share-column');
      const kids = col?.props.children;
      if (!kids) return [];
      const arr = Array.isArray(kids) ? kids : [kids];
      return arr.filter((c): c is AnyElement => Boolean(c) && typeof c === 'object');
    }

    /**
     * Find the first child whose `type` name matches `name`. The walker
     * doesn't execute function components, so we identify them by the
     * component reference's display name. Index-based lookup is brittle
     * because the share column has counter pill (conditional) + WA +
     * ShareGroup in a specific order.
     */
    function findChildByTypeName(children: AnyElement[], name: string): AnyElement | undefined {
      return children.find((c) => {
        const t = c.type as { name?: string; displayName?: string } | string;
        if (typeof t === 'string') return false;
        return t.name === name || t.displayName === name;
      });
    }

    it('renders the share column wrapper rooted on messageId', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      const col = findByTestId(tree, 'network-card-share-column');
      expect(col).toBeDefined();
      expect(col?.props['data-message-id']).toBe('42');
    });

    it('passes verified share counts through to the ShareGroup', () => {
      const counts = {
        total: 5,
        perDestination: {
          whatsapp: 2,
          x: 2,
          instagram: 0,
          facebook: 1,
          email: 0,
          copy_link: 0,
          other: 0,
        },
      };
      const tree = NetworkCard({
        card: makeCard({ shareCounts: counts }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      const children = shareColumnChildren(tree);
      const shareGroup = findChildByTypeName(children, 'ShareGroup');
      expect(shareGroup).toBeDefined();
      expect(shareGroup?.props.counts).toEqual(counts);
      expect(shareGroup?.props.targetType).toBe('network_card');
      expect(shareGroup?.props.targetId).toBe('42');
      expect(shareGroup?.props.hideCounter).toBe(true);
    });

    it('the share group receives the upstream URL (not a GPS page)', () => {
      const tree = NetworkCard({
        card: makeCard({ url: 'https://telegraph.co.uk/news/123' }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      const shareGroup = findChildByTypeName(shareColumnChildren(tree), 'ShareGroup');
      expect(shareGroup?.props.url).toBe('https://telegraph.co.uk/news/123');
    });

    it('uses the linkPreview title for the share text when available', () => {
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://example.com/article',
          linkTitle: 'Stale title',
          linkPreview: {
            title: 'Fresh OG title',
            description: null,
            imageUrl: null,
            siteName: null,
            faviconUrl: null,
          },
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      const shareGroup = findChildByTypeName(shareColumnChildren(tree), 'ShareGroup');
      expect(shareGroup?.props.title).toBe('Fresh OG title');
    });

    it('falls back to URL hostname as the share title when nothing else is available', () => {
      const tree = NetworkCard({
        card: makeCard({
          url: 'https://example.com/article',
          linkTitle: null,
          linkPreview: null,
        }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;

      const shareGroup = findChildByTypeName(shareColumnChildren(tree), 'ShareGroup');
      expect(shareGroup?.props.title).toBe('example.com');
    });

    it('renders the separate WhatsApp share button adjacent to the rail', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      const children = shareColumnChildren(tree);
      const wa = findChildByTypeName(children, 'WhatsAppShareTargetButton');
      expect(wa).toBeDefined();
      expect(wa?.props.targetType).toBe('network_card');
      expect(wa?.props.targetId).toBe('42');
      expect(wa?.props.url).toBe('https://example.com/article');
    });

    it('renders the standalone ShareCountPill at the top of the column when counts present', () => {
      const counts = {
        total: 3,
        perDestination: {
          whatsapp: 1,
          x: 1,
          instagram: 0,
          facebook: 1,
          email: 0,
          copy_link: 0,
          other: 0,
        },
      };
      const tree = NetworkCard({
        card: makeCard({ shareCounts: counts }),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      const children = shareColumnChildren(tree);
      // ShareCountPill is the first child, followed by WhatsApp, then ShareGroup.
      const pill = findChildByTypeName(children, 'ShareCountPill');
      expect(pill).toBeDefined();
      expect(pill?.props.counts).toEqual(counts);
      const order = children.map((c) => {
        const t = c.type as { name?: string } | string;
        return typeof t === 'string' ? t : (t.name ?? '');
      });
      expect(order).toEqual(['ShareCountPill', 'WhatsAppShareTargetButton', 'ShareGroup']);
    });

    it('forwards onShareInitiated callback with messageId + destination from ShareGroup', () => {
      const onShareInitiated = vi.fn();
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        onShareInitiated,
      }) as AnyElement;

      const shareGroup = findChildByTypeName(shareColumnChildren(tree), 'ShareGroup');
      const innerCb = shareGroup?.props.onShareInitiated as (d: string) => void;
      innerCb('facebook');
      expect(onShareInitiated).toHaveBeenCalledWith('42', 'facebook');
    });

    it('forwards onShareInitiated callback as whatsapp when the WA button fires', () => {
      const onShareInitiated = vi.fn();
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        onShareInitiated,
      }) as AnyElement;

      const wa = findChildByTypeName(shareColumnChildren(tree), 'WhatsAppShareTargetButton');
      const innerCb = wa?.props.onShareInitiated as () => void;
      innerCb();
      expect(onShareInitiated).toHaveBeenCalledWith('42', 'whatsapp');
    });
  });

  // bu-network-seen-state — NEW marker + dismiss toggle. All three
  // props are optional; absent renders the prior behaviour (existing
  // tests above already cover the no-prop path).
  describe('seen-state', () => {
    it('renders the NEW accent strip and SR label when isNew is true', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        isNew: true,
      }) as AnyElement;

      const strip = findByTestId(tree, 'network-card-new-strip');
      expect(strip).toBeDefined();
      expect(strip?.props['aria-hidden']).toBe('true');
      expect(tree.props['data-is-new']).toBe('true');
    });

    it('omits the NEW strip when isNew is false or unset', () => {
      const without = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(findByTestId(without, 'network-card-new-strip')).toBeUndefined();
      expect(without.props['data-is-new']).toBe('false');

      const explicit = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        isNew: false,
      }) as AnyElement;
      expect(findByTestId(explicit, 'network-card-new-strip')).toBeUndefined();
    });

    it('applies opacity 0.5 when dismissed', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        dismissed: true,
      }) as AnyElement;

      const style = tree.props.style as { opacity?: number };
      expect(style.opacity).toBe(0.5);
      expect(tree.props['data-dismissed']).toBe('true');
    });

    it('renders the eye-off toggle only when onToggleDismissed is provided', () => {
      const without = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
      }) as AnyElement;
      expect(findByTestId(without, 'network-card-dismiss-toggle')).toBeUndefined();

      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        onToggleDismissed: vi.fn(),
      }) as AnyElement;
      const btn = findByTestId(tree, 'network-card-dismiss-toggle');
      expect(btn).toBeDefined();
      expect(btn?.props['aria-label']).toBe('Mark as seen');
      expect(btn?.props['aria-pressed']).toBe(false);
    });

    it('fires onToggleDismissed and announces pressed state when dismissed', () => {
      const onToggleDismissed = vi.fn();
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        dismissed: true,
        onToggleDismissed,
      }) as AnyElement;

      const btn = findByTestId(tree, 'network-card-dismiss-toggle');
      expect(btn?.props['aria-pressed']).toBe(true);
      expect(btn?.props['aria-label']).toBe('Mark as not seen');

      const handler = btn?.props.onClick as (e: MouseEvent<HTMLButtonElement>) => void;
      handler(fakeMouseEvent());
      expect(onToggleDismissed).toHaveBeenCalledTimes(1);
    });

    it('keeps the NEW strip visible on a dismissed card (composable signals)', () => {
      const tree = NetworkCard({
        card: makeCard(),
        onSetStatus: vi.fn(),
        pending: false,
        isNew: true,
        dismissed: true,
      }) as AnyElement;

      expect(findByTestId(tree, 'network-card-new-strip')).toBeDefined();
      const style = tree.props.style as { opacity?: number };
      expect(style.opacity).toBe(0.5);
    });
  });
});
