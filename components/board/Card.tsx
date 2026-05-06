/**
 * @build-unit bu-coordination-board (build seq #4 — Surface 1, PR #4d)
 * @spec build/session-briefs/bu-coordination-board.md
 *
 * Card — a single kanban ticket on Surface 1. Pure presentational.
 * Click-through links to /board/[groupSlug]/[ticketId] (built in PR #5).
 *
 * Visual contract per the brief's "Surface 1 — Kanban board":
 *   - Title (one line, ellipsised at narrow widths).
 *   - Kind glyph + label (small row under the title). The glyph
 *     mirrors the FAB intent picker (`KindPickerSheet`) so members
 *     see the same icon when creating and when triaging the kind.
 *   - Multi-assignee avatar row with `+N` overflow.
 *   - Urgent flag — red dot in the top-right.
 *   - Last-updated relative time.
 *   - Unclaimed cards (no assignees) get a warning-subtle yellow tint.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  MobileTagSwitcher,
  type MobileTagSwitcherColumn,
} from '@/components/board/MobileTagSwitcher';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Feather,
  Link as LinkIcon,
  Megaphone,
  MessageCircle,
  Pin,
  Users,
  type LucideIcon,
} from 'lucide-react';

const AVATAR_VISIBLE_LIMIT = 3;

const KIND_GLYPH_SIZE = 14;

const KIND_GLYPH: Record<string, LucideIcon> = {
  happening_now: AlertTriangle,
  tick_or_cross: CheckSquare,
  link_share: LinkIcon,
  call_to_action: Megaphone,
  cultural: Feather,
  outcome: Pin,
  thought: MessageCircle,
  event: CalendarDays,
  meeting: Users,
};

export interface CardAssignee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CardProps {
  groupSlug: string;
  ticket: {
    id: string;
    title: string;
    kindSlug: string | null;
    kindDisplayName: string | null;
    isUrgent: boolean;
    assignees: CardAssignee[];
    updatedAt: Date;
  };
  /**
   * Mobile tag-switcher context. When provided, the card renders a
   * mobile-only column-switch pill. Required all-or-nothing — pass
   * all four together or omit them all (e.g. inside `DragOverlay`,
   * where the switcher would be redundant).
   */
  mobileSwitch?: {
    groupId: string;
    currentColumnId: string;
    columns: MobileTagSwitcherColumn[];
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

export function Card({ groupSlug, ticket, mobileSwitch }: CardProps) {
  const unclaimed = ticket.assignees.length === 0;
  const visible = ticket.assignees.slice(0, AVATAR_VISIBLE_LIMIT);
  const overflow = ticket.assignees.length - visible.length;
  const KindGlyph: LucideIcon | null = ticket.kindSlug
    ? (KIND_GLYPH[ticket.kindSlug] ?? null)
    : null;

  return (
    <div data-testid="board-card-wrapper" style={{ position: 'relative' }}>
      {mobileSwitch && (
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-2)',
            left: 'var(--space-2)',
            zIndex: 1,
            pointerEvents: 'auto',
          }}
        >
          <MobileTagSwitcher
            requestId={ticket.id}
            groupId={mobileSwitch.groupId}
            groupSlug={groupSlug}
            currentColumnId={mobileSwitch.currentColumnId}
            columns={mobileSwitch.columns}
          />
        </div>
      )}
      <Link
        href={`/board/${groupSlug}/${ticket.id}`}
        data-testid="board-card-link"
        data-ticket-id={ticket.id}
        style={{
          display: 'block',
          position: 'relative',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: unclaimed
            ? 'color-mix(in srgb, var(--colour-warning) 8%, var(--colour-surface-raised))'
            : 'var(--colour-surface-raised)',
          border: `1px solid ${
            unclaimed
              ? 'color-mix(in srgb, var(--colour-warning) 25%, var(--colour-border-subtle))'
              : 'var(--colour-border-subtle)'
          }`,
          textDecoration: 'none',
          color: 'inherit',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {ticket.isUrgent && (
          <span
            data-testid="board-card-urgent-dot"
            aria-label="Urgent"
            style={{
              position: 'absolute',
              top: 'var(--space-2)',
              right: 'var(--space-2)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--colour-danger)',
            }}
          />
        )}
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: 'var(--space-1)',
            paddingRight: ticket.isUrgent ? 'var(--space-4)' : 0,
          }}
        >
          {ticket.title}
        </div>
        {ticket.kindDisplayName && (
          <div
            data-testid="board-card-kind"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--text-xs)',
              color: 'var(--colour-text-secondary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            {KindGlyph && (
              <KindGlyph
                size={KIND_GLYPH_SIZE}
                aria-hidden="true"
                data-testid="board-card-kind-glyph"
                data-kind-slug={ticket.kindSlug}
              />
            )}
            <span>{ticket.kindDisplayName}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}
        >
          <div
            data-testid="board-card-assignees"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {visible.map((a) => (
              <span
                key={a.userId}
                title={a.displayName}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: a.avatarUrl
                    ? `center / cover no-repeat url(${a.avatarUrl})`
                    : 'var(--colour-surface-sunken)',
                  color: 'var(--colour-text-secondary)',
                  fontSize: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--colour-border-subtle)',
                }}
              >
                {a.avatarUrl ? '' : initials(a.displayName)}
              </span>
            ))}
            {overflow > 0 && (
              <span
                data-testid="board-card-assignees-overflow"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-secondary)',
                  marginLeft: 4,
                }}
              >
                +{overflow}
              </span>
            )}
          </div>
          <span
            data-testid="board-card-updated"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--colour-text-secondary)',
            }}
          >
            {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
          </span>
        </div>
      </Link>
    </div>
  );
}
