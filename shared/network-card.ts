/**
 * @build-unit BU-network-feed
 * @spec architecture/decision-log.md (D083)
 * @spec adrs/0017-network-card-state.md
 *
 * Wire-boundary types for the /network surface. The cards themselves
 * are read from Grant (AIFA)'s external Supabase view
 * `public.gps_group_messages`; the workflow state comes from our own
 * `NetworkCardState` table (ADR-0017). The shape returned to the
 * client is a join of the two — this file is the contract.
 *
 * `id` is a bigint at the schema level (Grant's column type).
 * superjson handles bigint at the tRPC wire boundary, so the client
 * receives a real bigint primitive — not a stringified one.
 *
 * The status union mirrors the Prisma enum `NetworkCardStatus`. Keep
 * this file and `prisma/schema.prisma` in sync, same convention as
 * the reaction `ReactionEmojiSchema` mirror.
 */

/** Mirrors Prisma's NetworkCardStatus enum. Keep in sync. */
export type NetworkCardStatus = 'NEW' | 'TRIAGED' | 'PROMOTED' | 'DISCARDED';

export const NETWORK_CARD_STATUSES: ReadonlyArray<NetworkCardStatus> = [
  'NEW',
  'TRIAGED',
  'PROMOTED',
  'DISCARDED',
];

export interface NetworkCardWorkflowState {
  status: NetworkCardStatus;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  notes: string | null;
  updatedAt: Date | null;
}

/**
 * OpenGraph preview enrichment, populated server-side by the network
 * service when the `network_link_previews` flag is on. `null` means
 * either the flag is off, the URL was unreachable, or the page had
 * no parseable metadata. Callers render the existing
 * `<LinkPreviewCard>` only when this is non-null.
 */
export interface NetworkCardLinkPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  /**
   * Page favicon (resolved absolute URL). Rendered as a small inline
   * icon in the site row when `imageUrl` is null — pages with no
   * `og:image` collapse to a text-with-icon card instead of a blank
   * grey hero block.
   */
  faviconUrl: string | null;
}

/**
 * bu-network-shares — verified share counts per card. Total is the
 * verified-only count (D047); perDestination breaks it down so the
 * tooltip can show the breakdown. Always present on the wire
 * (zero-filled for cards with no shares) so the renderer doesn't
 * need a null check.
 */
export interface NetworkCardShareCounts {
  total: number;
  perDestination: {
    whatsapp: number;
    x: number;
    instagram: number;
    facebook: number;
    email: number;
    copy_link: number;
    other: number;
  };
}

/**
 * bu-network-source-chips — per-source metadata joined from Grant's
 * `public.gps_chat_labels` view. `slug` is the URL-state key (stable
 * across label renames). Per Grant 2026-05-11 Round 3: `gps_chat_labels`
 * is a view of `gps.allowed_chats` — same table — so every row in
 * `gps_group_messages` joins to a label row atomically (slug is auto-
 * generated via INSERT trigger). `source` is therefore non-null on
 * `NetworkCard`. `color` and `icon` are starter values from Grant; the
 * renderer treats them as fallbacks behind a token-palette override
 * map (`styles/source-palette.ts`).
 */
export interface NetworkCardSource {
  slug: string;
  label: string;
  description: string | null;
  displayOrder: number;
  color: string | null;
  icon: string | null;
  memberCount: number | null;
}

/**
 * bu-network-source-chips — chip-strip shape. Same as
 * `NetworkCardSource` but listed separately as the standalone
 * "source set" returned by `listNetworkSources`.
 */
export type NetworkSource = NetworkCardSource;

export interface NetworkCard {
  id: bigint;
  sentAt: Date;
  url: string;
  linkTitle: string | null;
  textBody: string | null;
  fromName: string | null;
  senderHash: string;
  chatId: string;
  state: NetworkCardWorkflowState;
  linkPreview: NetworkCardLinkPreview | null;
  /** bu-network-shares — verified share counts. Zero-filled when no shares. */
  shareCounts: NetworkCardShareCounts;
  /**
   * bu-network-source-chips — joined source metadata from
   * `gps_chat_labels`. Non-null because `gps_chat_labels` is a view
   * of `gps.allowed_chats` — every message row has a label row by
   * construction (Grant 2026-05-11 Round 3).
   */
  source: NetworkCardSource;
  /**
   * bu-network-source-chips — Grant's `is_forwarded` column on
   * `gps_group_messages` (~28% of feed). Renders a small "↪ forwarded"
   * badge in the card meta row.
   */
  isForwarded: boolean;
}

export interface NetworkListResponse {
  items: NetworkCard[];
  nextCursor: string | null;
  fetchedAt: Date;
  fromCache: boolean;
}

// ── Wire-serialised variants (server-component → client-component boundary)
//
// React Server Components support bigint at the props boundary, but
// stringifying keeps the client surface portable across test environments
// (jsdom + serialised snapshots) and matches the existing FeedPost pattern
// in `components/PostCard.tsx`. Server actions also accept the string form
// and convert at the boundary.

export interface SerializedNetworkCardWorkflowState {
  status: NetworkCardStatus;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  notes: string | null;
  /** ISO 8601 string. Null when no state row exists. */
  updatedAt: string | null;
}

export interface SerializedNetworkCard {
  /** Stringified bigint. */
  messageId: string;
  /** ISO 8601 string. */
  sentAt: string;
  url: string;
  linkTitle: string | null;
  textBody: string | null;
  fromName: string | null;
  senderHash: string;
  chatId: string;
  state: SerializedNetworkCardWorkflowState;
  linkPreview: NetworkCardLinkPreview | null;
  /** bu-network-shares — verified share counts. Zero-filled when no shares. */
  shareCounts: NetworkCardShareCounts;
  /** bu-network-source-chips — joined source metadata (non-null per Round 3). */
  source: NetworkCardSource;
  /** bu-network-source-chips — forwarded-message flag. */
  isForwarded: boolean;
}

/**
 * BU-network-reactions — wire-boundary reaction aggregate. Identical
 * shape to `FeedReaction` (components/PostCard.tsx) so the existing
 * polymorphic ReactionPill can consume it directly without a wrapper.
 * Lives here rather than in `shared/network-card` types because the
 * /network surface lazy-fetches reactions per visible window — they're
 * intentionally NOT part of the SerializedNetworkCard payload.
 */
export interface SerializedNetworkCardReaction {
  emoji: 'candle' | 'pray' | 'heart' | 'strong' | 'target' | 'sparkle' | 'thumbsup' | 'sad';
  count: number;
  mine: boolean;
}

export interface SerializedNetworkListResponse {
  items: SerializedNetworkCard[];
  nextCursor: string | null;
  /** ISO 8601 string — when the upstream fetch completed. */
  fetchedAt: string;
  fromCache: boolean;
}

export function serializeNetworkCard(card: NetworkCard): SerializedNetworkCard {
  return {
    messageId: card.id.toString(),
    sentAt: card.sentAt.toISOString(),
    url: card.url,
    linkTitle: card.linkTitle,
    textBody: card.textBody,
    fromName: card.fromName,
    senderHash: card.senderHash,
    chatId: card.chatId,
    state: {
      status: card.state.status,
      ownerUserId: card.state.ownerUserId,
      ownerDisplayName: card.state.ownerDisplayName,
      notes: card.state.notes,
      updatedAt: card.state.updatedAt ? card.state.updatedAt.toISOString() : null,
    },
    linkPreview: card.linkPreview,
    shareCounts: card.shareCounts,
    source: card.source,
    isForwarded: card.isForwarded,
  };
}

/**
 * bu-network-shares — zero-filled share-counts object. Used as the
 * default when a card has no entries in ShareEvent or when the
 * projection is intentionally skipped (e.g. test fixtures).
 */
export function emptyNetworkCardShareCounts(): NetworkCardShareCounts {
  return {
    total: 0,
    perDestination: {
      whatsapp: 0,
      x: 0,
      instagram: 0,
      facebook: 0,
      email: 0,
      copy_link: 0,
      other: 0,
    },
  };
}

export function serializeNetworkListResponse(
  response: NetworkListResponse,
): SerializedNetworkListResponse {
  return {
    items: response.items.map(serializeNetworkCard),
    nextCursor: response.nextCursor,
    fetchedAt: response.fetchedAt.toISOString(),
    fromCache: response.fromCache,
  };
}
