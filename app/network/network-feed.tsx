'use client';

/**
 * @build-unit BU-network-feed BU-network-reactions
 * @spec adrs/0017-network-card-state.md
 * @spec product/design-philosophy.md
 *
 * Client surface for /network. Holds list state, dispatches the three
 * server actions (refresh / load-more / set-state), and renders the
 * empty / loading / loaded views.
 *
 * Triage is optimistic — the in-flight card flips status immediately,
 * with rollback on failure. Pending state per-card prevents duplicate
 * clicks during the round-trip.
 *
 * Per-device refresh affordance: a manual "Refresh" button at the top
 * of the list, plus an inline "fetched <X> ago / from cache" status
 * line. Pull-to-refresh on touch is the browser's native behaviour
 * over `<main>` — no extra wiring needed for v1.
 *
 * BU-network-reactions — reactions are lazy-fetched in bulk for the
 * visible card window via `listReactionsForNetworkCardsAction`. The
 * fetch fires once on mount and again after refresh / load-more, so
 * the pill renders with aggregate counts the first paint after each
 * server round-trip. Per-card toggle is wired through
 * `addReactionToNetworkCardAction` / `removeReactionFromNetworkCardAction`
 * — the pill itself owns optimistic state, so this layer just relays.
 */

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ShareDestination } from '@prisma/client';
import { Loader2, RefreshCw } from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';
import { NetworkCard } from '@/components/NetworkCard';
import { PageHeader } from '@/components/PageHeader';
import { ShareConfirmDialog } from '@/components/ShareConfirmDialog';
import { pingShareIntent } from '@/components/ShareGroup';
import {
  refreshNetworkList,
  loadMoreNetworkCards,
  setNetworkCardStateAction,
  addReactionToNetworkCardAction,
  removeReactionFromNetworkCardAction,
  listReactionsForNetworkCardsAction,
} from '@/app/network/actions';
import type {
  NetworkCardStatus,
  SerializedNetworkCard,
  SerializedNetworkListResponse,
} from '@/shared/network-card';
import type { FeedReaction, FeedReactionEmoji } from '@/components/PostCard';
import {
  getDismissedIds,
  getLastVisitedAt,
  setLastVisitedAt,
  toggleDismissed as toggleDismissedInStorage,
} from '@/shared/lib/network-seen-state';

interface NetworkFeedProps {
  initial: SerializedNetworkListResponse;
  /** Server-rendered chip strip (passed in from page.tsx). */
  chipStrip: ReactNode;
  /** Server-rendered sort control (passed in from page.tsx). */
  sortControl: ReactNode;
  /**
   * bu-network-spread-gallery — server-rendered "switch to gallery"
   * anchor. Slotted in the PageHeader `actions` row beside the
   * refresh button so view-switchers sit in a consistent position
   * with the gallery's reciprocal "list view" anchor.
   */
  galleryButton?: ReactNode;
  /**
   * bu-network-seen-state — when true, hide cards where `isNew` is
   * false. URL-bound via `?unread=1`. Defaults to false (show all).
   */
  unreadOnly?: boolean;
}

export function NetworkFeed({
  initial,
  chipStrip,
  sortControl,
  galleryButton,
  unreadOnly = false,
}: NetworkFeedProps) {
  const [items, setItems] = useState<SerializedNetworkCard[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [fetchedAt, setFetchedAt] = useState<string>(initial.fetchedAt);
  const [fromCache, setFromCache] = useState<boolean>(initial.fromCache);
  // bu-network-card-body-clamp — admin-tunable threshold piggybacks
  // on the list response. Picks up any tune-change on the next page
  // refresh (no live re-render needed; we don't shift this often).
  const [bodyClampThresholdLines, setBodyClampThresholdLines] = useState<number>(
    initial.bodyClampThresholdLines,
  );
  const [pendingByMessageId, setPendingByMessageId] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // BU-network-reactions — keyed by messageId, lazy-fetched on mount
  // and after every refresh / load-more. Empty array per card until
  // the bulk fetch resolves.
  const [reactionsByMessageId, setReactionsByMessageId] = useState<Record<string, FeedReaction[]>>(
    {},
  );
  // Ref mirrors the state — read inside effects to compute which
  // messageIds need fetching without taking `reactionsByMessageId`
  // as an effect dep (would loop on every fetch resolution) and
  // without calling a side-effecting fetch from inside a setState
  // updater (React 19 catches that as setState-during-render).
  const reactionsRef = useRef(reactionsByMessageId);
  reactionsRef.current = reactionsByMessageId;
  // bu-network-shares — verify-prompt state. Tracks which card and
  // destination are awaiting confirmation. Null = no prompt visible.
  // Lifted here (out of NetworkCard) so that NetworkCard stays pure-
  // presentational and unit-testable as a plain function call.
  const [pendingShare, setPendingShare] = useState<{
    messageId: string;
    destination: ShareDestination;
  } | null>(null);

  // bu-network-seen-state — per-browser state for the NEW marker and
  // mark-as-seen toggle. Both reads happen once on mount inside an
  // effect (SSR has no localStorage). `lastVisitedAtSnapshot` is the
  // value at mount time — frozen for the lifetime of the page so
  // cards arriving via refresh or load-more continue to be compared
  // against the visit anchor rather than a moving target. First
  // visit (snapshot === null) treats every card as new for this
  // session, so the Unread-only chip surfaces the whole list instead
  // of looking broken; the anchor written this visit means the next
  // visit narrows to genuinely-new cards.
  const [lastVisitedAtSnapshot, setLastVisitedAtSnapshot] = useState<Date | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [seenStateHydrated, setSeenStateHydrated] = useState(false);

  useEffect(() => {
    const previous = getLastVisitedAt();
    setLastVisitedAtSnapshot(previous);
    setDismissedIds(getDismissedIds());
    setLastVisitedAt(new Date());
    setSeenStateHydrated(true);
  }, []);

  const handleToggleDismissed = useCallback((messageId: string): void => {
    const nowDismissed = toggleDismissedInStorage(messageId);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      if (nowDismissed) {
        next.add(messageId);
      } else {
        next.delete(messageId);
      }
      return next;
    });
  }, []);

  const fetchReactionsFor = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      const map = await listReactionsForNetworkCardsAction(messageIds);
      setReactionsByMessageId((prev) => ({ ...prev, ...map }));
    } catch (err) {
      // Reactions are decorative — never block the list. Log only.
      console.warn('[network-feed] reaction fetch failed', err);
    }
  }, []);

  // Initial fetch + after items change. We diff against the ref
  // (not the state) so `reactionsByMessageId` can stay out of the
  // dep list (would loop on every fetch resolution) and the side-
  // effecting fetch stays at the top level of the effect (not
  // inside a setState updater — React 19's setState-during-render
  // detector flags any side effect cascading through a setState
  // call, including server actions that trigger Router updates).
  useEffect(() => {
    const ids = items.map((c) => c.messageId);
    const missing = ids.filter((id) => !(id in reactionsRef.current));
    if (missing.length > 0) void fetchReactionsFor(missing);
  }, [items, fetchReactionsFor]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    startTransition(async () => {
      try {
        const fresh = await refreshNetworkList({});
        setItems(fresh.items);
        setCursor(fresh.nextCursor);
        setFetchedAt(fresh.fetchedAt);
        setFromCache(fresh.fromCache);
        setBodyClampThresholdLines(fresh.bodyClampThresholdLines);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Refresh failed.');
      } finally {
        setRefreshing(false);
      }
    });
  }, [refreshing]);

  const handleLoadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    startTransition(async () => {
      try {
        const more = await loadMoreNetworkCards(cursor);
        setItems((prev) => [...prev, ...more.items]);
        setCursor(more.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Load more failed.');
      } finally {
        setLoadingMore(false);
      }
    });
  }, [cursor, loadingMore]);

  const handleAddReaction = useCallback(
    async (messageId: string, emoji: FeedReactionEmoji): Promise<void> => {
      await addReactionToNetworkCardAction(messageId, emoji);
      // The pill owns committed/optimistic state. We re-fetch the aggregate
      // for this card so the next remount or refresh has truth.
      const map = await listReactionsForNetworkCardsAction([messageId]);
      setReactionsByMessageId((prev) => ({ ...prev, ...map }));
    },
    [],
  );

  const handleRemoveReaction = useCallback(
    async (messageId: string, emoji: FeedReactionEmoji): Promise<void> => {
      await removeReactionFromNetworkCardAction(messageId, emoji);
      const map = await listReactionsForNetworkCardsAction([messageId]);
      setReactionsByMessageId((prev) => ({ ...prev, ...map }));
    },
    [],
  );

  // bu-network-shares — capture share-intent from cards, queue the
  // verify-prompt dialog. The intent ping has already fired by the
  // time we get here (ShareGroup / WhatsAppShareTargetButton fire it
  // before the new-tab navigation).
  const handleShareInitiated = useCallback(
    (messageId: string, destination: ShareDestination): void => {
      setPendingShare({ messageId, destination });
    },
    [],
  );

  const handleShareConfirm = useCallback((): void => {
    if (!pendingShare) return;
    pingShareIntent({
      targetType: 'network_card',
      targetId: pendingShare.messageId,
      destination: pendingShare.destination,
      verified: true,
    });
    // Optimistic counter tick — bump the per-card total + per-destination
    // count so the pill updates immediately. The next list refresh will
    // re-project from ShareEvent and reconcile any drift.
    setItems((prev) =>
      prev.map((c) => {
        if (c.messageId !== pendingShare.messageId) return c;
        const prevPer = c.shareCounts.perDestination;
        return {
          ...c,
          shareCounts: {
            total: c.shareCounts.total + 1,
            perDestination: {
              ...prevPer,
              [pendingShare.destination]: (prevPer[pendingShare.destination] ?? 0) + 1,
            },
          },
        };
      }),
    );
    setPendingShare(null);
  }, [pendingShare]);

  const handleShareSkip = useCallback((): void => {
    setPendingShare(null);
  }, []);

  // bu-network-seen-state — derive per-card isNew + the visible
  // subset under the Unread-only filter. Both depend on the hydrated
  // anchor; before hydration, `isNew` is false for every card and
  // the filter is a no-op (server-rendered pass-through keeps SSR
  // and first paint stable — no FOUC of NEW strips appearing on
  // mount).
  const isNewByMessageId = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!seenStateHydrated) return map;
    // First visit ever: no prior anchor to compare against. Treat every
    // card as new for this session so Unread-only shows the full list
    // on first paint rather than an empty "all caught up" state.
    if (lastVisitedAtSnapshot === null) {
      for (const card of items) map.set(card.messageId, true);
      return map;
    }
    const anchorMs = lastVisitedAtSnapshot.getTime();
    for (const card of items) {
      const sentMs = new Date(card.sentAt).getTime();
      if (!Number.isNaN(sentMs) && sentMs > anchorMs) map.set(card.messageId, true);
    }
    return map;
  }, [items, lastVisitedAtSnapshot, seenStateHydrated]);

  const visibleItems = useMemo(() => {
    if (!unreadOnly) return items;
    // Before hydration we don't know which cards are new — show
    // nothing rather than flash the full list. After hydration,
    // filter to isNew only.
    if (!seenStateHydrated) return [];
    return items.filter((c) => isNewByMessageId.get(c.messageId) === true);
  }, [items, unreadOnly, seenStateHydrated, isNewByMessageId]);

  const handleSetStatus = useCallback((card: SerializedNetworkCard, status: NetworkCardStatus) => {
    const prevState = card.state;
    setPendingByMessageId((p) => ({ ...p, [card.messageId]: true }));
    // Optimistic: flip status locally before the round-trip.
    setItems((prev) =>
      prev.map((c) =>
        c.messageId === card.messageId ? { ...c, state: { ...c.state, status } } : c,
      ),
    );
    startTransition(async () => {
      try {
        const next = await setNetworkCardStateAction({
          messageId: card.messageId,
          status,
        });
        setItems((prev) =>
          prev.map((c) => (c.messageId === card.messageId ? { ...c, state: next } : c)),
        );
      } catch (err) {
        // Rollback on failure.
        setItems((prev) =>
          prev.map((c) => (c.messageId === card.messageId ? { ...c, state: prevState } : c)),
        );
        setError(err instanceof Error ? err.message : 'Could not update.');
      } finally {
        setPendingByMessageId((p) => {
          const next = { ...p };
          delete next[card.messageId];
          return next;
        });
      }
    });
  }, []);

  const refreshButton = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <style>{`@keyframes gps-network-refresh-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        data-testid="network-fetched-status"
        data-from-cache={fromCache ? 'true' : 'false'}
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-tertiary)',
          whiteSpace: 'nowrap',
        }}
      >
        {/*
         * `relativeTimeShort()` reads `Date.now()`, which drifts between
         * SSR and first client paint. ClientOnly renders a static `0s`
         * during SSR + first paint so hydration stays clean, then swaps
         * to the live value.
         */}
        <ClientOnly fallback={<>0s</>}>{relativeTimeShort(fetchedAt)}</ClientOnly>
      </span>
      <button
        type="button"
        data-testid="network-refresh-button"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label={refreshing ? 'Refreshing…' : 'Refresh'}
        title={refreshing ? 'Refreshing…' : `${fromCache ? 'Cached' : 'Fresh'} · click to refresh`}
        style={refreshButtonStyle}
      >
        {refreshing ? (
          <Loader2
            size={18}
            aria-hidden="true"
            style={{ animation: 'gps-network-refresh-spin 700ms linear infinite' }}
          />
        ) : (
          <RefreshCw size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );

  return (
    <div data-testid="network-feed">
      <PageHeader
        title="Network"
        description="Links shared in your WhatsApp groups, newest first"
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {galleryButton}
            {refreshButton}
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            minWidth: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>{chipStrip}</div>
          {sortControl}
        </div>
      </PageHeader>
      <div style={{ padding: 'var(--space-5) var(--space-8) var(--space-8)' }}>
        {error && (
          <p
            data-testid="network-error"
            role="alert"
            style={{
              color: 'var(--colour-urgent)',
              fontSize: 'var(--text-sm)',
              margin: '0 0 var(--space-3) 0',
            }}
          >
            {error}
          </p>
        )}

        {visibleItems.length === 0 ? (
          unreadOnly && items.length > 0 ? (
            <NetworkAllCaughtUpState />
          ) : (
            <NetworkEmptyState />
          )
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleItems.map((card) => (
              <li key={card.messageId}>
                <NetworkCard
                  card={card}
                  pending={Boolean(pendingByMessageId[card.messageId])}
                  onSetStatus={(status) => handleSetStatus(card, status)}
                  reactions={reactionsByMessageId[card.messageId] ?? []}
                  onAddReaction={(emoji) => handleAddReaction(card.messageId, emoji)}
                  onRemoveReaction={(emoji) => handleRemoveReaction(card.messageId, emoji)}
                  onShareInitiated={handleShareInitiated}
                  isNew={isNewByMessageId.get(card.messageId) ?? false}
                  dismissed={dismissedIds.has(card.messageId)}
                  onToggleDismissed={() => handleToggleDismissed(card.messageId)}
                  bodyClampThresholdLines={bodyClampThresholdLines}
                />
              </li>
            ))}
          </ul>
        )}

        {cursor && (
          <button
            type="button"
            data-testid="network-load-more"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={loadMoreButtonStyle}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}

        {pendingShare && (
          <ShareConfirmDialog
            targetType="network_card"
            targetId={pendingShare.messageId}
            destination={pendingShare.destination}
            open
            onConfirm={handleShareConfirm}
            onSkip={handleShareSkip}
          />
        )}
      </div>
    </div>
  );
}

function NetworkEmptyState() {
  return (
    <div
      data-testid="network-empty"
      style={{
        textAlign: 'center',
        padding: 'var(--space-8) 0',
        color: 'var(--colour-text-secondary)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-base)',
      }}
    >
      <p style={{ margin: 0, marginBottom: 'var(--space-2)' }}>Quiet in here.</p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--colour-text-tertiary)' }}>
        New shares from the network will appear when members post them.
      </p>
    </div>
  );
}

// bu-network-seen-state — shown when the Unread-only filter is on
// and no card has arrived since the user's previous visit. Distinct
// from the genuinely-empty state — the underlying list is not empty,
// the user has just caught up.
function NetworkAllCaughtUpState() {
  return (
    <div
      data-testid="network-all-caught-up"
      style={{
        textAlign: 'center',
        padding: 'var(--space-8) 0',
        color: 'var(--colour-text-secondary)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-base)',
      }}
    >
      <p style={{ margin: 0, marginBottom: 'var(--space-2)' }}>You&rsquo;re all caught up.</p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--colour-text-tertiary)' }}>
        Turn off &ldquo;Unread only&rdquo; to see the full list.
      </p>
    </div>
  );
}

const refreshButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
};

const loadMoreButtonStyle: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  padding: 'var(--space-2) var(--space-4)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  color: 'var(--colour-text-link)',
  cursor: 'pointer',
  display: 'block',
  margin: 'var(--space-4) auto 0',
};

/** Compact relative time ("3s", "2m", "2h", "1d") for the inline
 * freshness pill next to the refresh icon. The `ago` suffix from the
 * older `relativeTime()` was redundant once the freshness sits beside
 * an obvious refresh affordance. */
function relativeTimeShort(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
