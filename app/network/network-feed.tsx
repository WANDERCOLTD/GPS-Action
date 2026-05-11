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

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { NetworkCard } from '@/components/NetworkCard';
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

interface NetworkFeedProps {
  initial: SerializedNetworkListResponse;
}

export function NetworkFeed({ initial }: NetworkFeedProps) {
  const [items, setItems] = useState<SerializedNetworkCard[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [fetchedAt, setFetchedAt] = useState<string>(initial.fetchedAt);
  const [fromCache, setFromCache] = useState<boolean>(initial.fromCache);
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

  // Initial fetch + after items change. The dep list intentionally
  // omits `reactionsByMessageId` — including it would loop the effect
  // every time the fetch resolved. We diff manually via `missing`
  // inside the effect body instead.
  useEffect(() => {
    const ids = items.map((c) => c.messageId);
    setReactionsByMessageId((prev) => {
      const missing = ids.filter((id) => !(id in prev));
      if (missing.length > 0) void fetchReactionsFor(missing);
      return prev;
    });
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

  return (
    <div data-testid="network-feed">
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="gps-title" style={{ margin: 0 }}>
          Network
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-3)',
            color: 'var(--colour-text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span data-testid="network-fetched-status" data-from-cache={fromCache ? 'true' : 'false'}>
            {fromCache ? 'cached' : 'fresh'} ·{' '}
            {/*
             * `relativeTime()` reads `Date.now()`, which always drifts
             * between SSR and first client paint — same fetchedAt, but
             * a second has passed, so SSR renders "0s ago" and client
             * hydrates to "1s ago". ClientOnly renders the static
             * fallback during SSR + first paint (matching the server
             * exactly), then swaps to the live formatter after mount.
             */}
            <ClientOnly fallback={<>0s ago</>}>{relativeTime(fetchedAt)}</ClientOnly>
          </span>
          <button
            type="button"
            data-testid="network-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={refreshButtonStyle}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

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

      {items.length === 0 ? (
        <NetworkEmptyState />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((card) => (
            <li key={card.messageId}>
              <NetworkCard
                card={card}
                pending={Boolean(pendingByMessageId[card.messageId])}
                onSetStatus={(status) => handleSetStatus(card, status)}
                reactions={reactionsByMessageId[card.messageId] ?? []}
                onAddReaction={(emoji) => handleAddReaction(card.messageId, emoji)}
                onRemoveReaction={(emoji) => handleRemoveReaction(card.messageId, emoji)}
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

const refreshButtonStyle: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  padding: 'var(--space-1) var(--space-3)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-pill)',
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

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
