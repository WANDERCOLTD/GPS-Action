/**
 * @build-unit BU-ticket-detail-relayout
 * @spec docs/build/session-briefs/BU-ticket-detail-relayout.md
 *
 * Right-rail container for the ticket-detail page. Locks the panel
 * order specified in Q1 of the design pass:
 *
 *   1. Lifecycle Status   — CardLifecycleActions (variant="surface-2")
 *   2. Assignees          — avatar list + AssignSelfButton
 *   3. Following          — FollowSelfButton
 *   4. Shared With        — SharedWithStrip + ShareWithTeamButton
 *   5. Originator + Created — compact one-liner ("Filed … N ago")
 *   6. Last activity      — compact one-liner ("Last activity N ago")
 *   ── footer ──
 *   7. Header actions     — DeleteTicketButton (gated) (Q2)
 *
 * On viewports >= 1024px the rail renders as a fixed-width 304px
 * column. Below that breakpoint the parent page switches to a
 * single-column cascade and the rail re-renders inline above the
 * Discussion thread (Q3 — option C). The component itself is layout-
 * agnostic; the parent decides where to place it.
 *
 * Pure View. No router / service / schema work — child components
 * are mounted unchanged; this component only owns the rail's chrome
 * (panel containers, dividers, footer block). Data flows in via
 * props from the server-rendered page.
 *
 * Q8b: no collapsibles in v1. Every panel renders fully expanded.
 */

import type { ReactElement, ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AssignSelfButton, FollowSelfButton } from '@/components/board/BoardActionPair';
import {
  CardLifecycleActions,
  type CardLifecycleStatus,
} from '@/components/board/CardLifecycleActions';
import { ShareWithTeamButton } from '@/components/board/ShareWithTeamButton';
import { SharedWithStrip, type SharedWithGroup } from '@/components/board/SharedWithStrip';
import { DeleteTicketButton } from '@/components/board/DeleteTicketButton';

interface RailAssignee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface RailShareTarget {
  groupId: string;
  displayName: string;
  slug: string;
}

export interface TicketDetailRailProps {
  requestId: string;
  groupSlug: string;
  groupId: string;
  // Lifecycle
  cardLifecycleStatus: CardLifecycleStatus | null;
  currentColumnId: string | null;
  activeColumns: Array<{ id: string; displayName: string }>;
  // Assignees
  assignees: RailAssignee[];
  isMineActive: boolean;
  // Following
  isMineSubscribed: boolean;
  // Shared with
  sharedGroups: SharedWithGroup[];
  availableShareTargets: RailShareTarget[];
  // Originator + dates
  /** True when the viewer is the ticket originator. */
  viewerIsOriginator: boolean;
  /** Ticket creation timestamp. */
  createdAt: Date;
  lastActivityAt: Date;
  // Footer / header actions
  canDelete: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

const PANEL_BG = 'var(--colour-surface-sunken)';
const PANEL_RADIUS = 'var(--radius-md)';
const PANEL_PADDING = 'var(--space-3)';

const SECTION_HEADING_STYLE = {
  margin: 0,
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'var(--colour-text-secondary)',
};

interface PanelProps {
  testid: string;
  ariaLabel: string;
  heading: string;
  headingTrailing?: ReactNode;
  children?: ReactNode;
}

/**
 * Renders a rail panel as a `<section>` ReactElement. Implemented as a
 * plain factory (not a React component) so the resulting tree exposes
 * the section element directly — the unit test tree-walker can then
 * find `data-rail-panel` attributes without rendering the page.
 */
function railPanel({
  testid,
  ariaLabel,
  heading,
  headingTrailing,
  children,
}: PanelProps): ReactElement {
  return (
    <section
      data-testid={testid}
      data-rail-panel={testid}
      aria-label={ariaLabel}
      style={{
        padding: PANEL_PADDING,
        background: PANEL_BG,
        borderRadius: PANEL_RADIUS,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <h2 style={SECTION_HEADING_STYLE}>{heading}</h2>
        {headingTrailing}
      </div>
      {children}
    </section>
  );
}

export function TicketDetailRail(props: TicketDetailRailProps) {
  const {
    requestId,
    groupSlug,
    groupId,
    cardLifecycleStatus,
    currentColumnId,
    activeColumns,
    assignees,
    isMineActive,
    isMineSubscribed,
    sharedGroups,
    availableShareTargets,
    viewerIsOriginator,
    createdAt,
    lastActivityAt,
    canDelete,
  } = props;

  const filedSuffix = formatDistanceToNow(createdAt, { addSuffix: true });
  const filedLine = viewerIsOriginator ? `Filed by you ${filedSuffix}` : `Filed ${filedSuffix}`;
  const lastActivityLine = `Last activity ${formatDistanceToNow(lastActivityAt, {
    addSuffix: true,
  })}`;

  return (
    <aside
      data-testid="board-ticket-detail-rail"
      aria-label="Ticket details"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {/* Panel 1 — Lifecycle Status (indicator only; the Move-to-board
          buttons live in the footer block alongside Delete per Q1's
          "Header actions" panel). */}
      {cardLifecycleStatus &&
        railPanel({
          testid: 'board-ticket-rail-lifecycle',
          ariaLabel: 'Lifecycle status',
          heading: 'Lifecycle status',
          children: (
            <p
              data-testid="board-ticket-rail-lifecycle-label"
              data-status={cardLifecycleStatus}
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background:
                    cardLifecycleStatus === 'active'
                      ? 'var(--colour-status-active, var(--colour-accent))'
                      : cardLifecycleStatus === 'done'
                        ? 'var(--colour-status-done, var(--colour-text-secondary))'
                        : 'var(--colour-text-secondary)',
                }}
              />
              {cardLifecycleStatus === 'active'
                ? 'Active'
                : cardLifecycleStatus === 'backlog'
                  ? 'Backlog'
                  : 'Done'}
            </p>
          ),
        })}

      {/* Panel 2 — Assignees */}
      {railPanel({
        testid: 'board-ticket-rail-assignees',
        ariaLabel: 'Assignees',
        heading: 'Assignees',
        headingTrailing: (
          <AssignSelfButton requestId={requestId} groupSlug={groupSlug} assigned={isMineActive} />
        ),
        children:
          assignees.length === 0 ? (
            <p
              data-testid="board-ticket-assignees-empty"
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--colour-text-secondary)',
              }}
            >
              No one is assigned yet.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              {assignees.map((a) => (
                <li
                  key={a.userId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '4px 10px 4px 4px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--colour-surface-raised)',
                    border: '1px solid var(--colour-border-subtle)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span
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
                  {a.displayName}
                </li>
              ))}
            </ul>
          ),
      })}

      {/* Panel 3 — Following */}
      {railPanel({
        testid: 'board-ticket-rail-following',
        ariaLabel: 'Following',
        heading: 'Following',
        headingTrailing: (
          <FollowSelfButton
            requestId={requestId}
            groupSlug={groupSlug}
            following={isMineSubscribed}
          />
        ),
      })}

      {/* Panel 4 — Shared with */}
      {railPanel({
        testid: 'board-ticket-rail-shared-with',
        ariaLabel: 'Shared with',
        heading: 'Shared with',
        children: (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <SharedWithStrip requestId={requestId} groupSlug={groupSlug} groups={sharedGroups} />
            <ShareWithTeamButton
              requestId={requestId}
              groupSlug={groupSlug}
              sourceGroupId={groupId}
              availableTargets={availableShareTargets}
            />
          </div>
        ),
      })}

      {/* Panel 5 + 6 — Originator + Last activity (compact lines) */}
      <div
        data-testid="board-ticket-rail-meta"
        aria-label="Provenance"
        style={{
          padding: `0 ${PANEL_PADDING}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        <span data-testid="board-ticket-rail-filed">{filedLine}</span>
        <span data-testid="board-ticket-rail-last-activity">{lastActivityLine}</span>
      </div>

      {/* Panel 7 — Header actions footer (Q2). Move-to-board lives here
          alongside Delete so the destructive + structural moves sit
          out of the primary-glance zone, harder to fat-finger. */}
      {(canDelete || cardLifecycleStatus) && (
        <div
          data-testid="board-ticket-rail-footer-actions"
          aria-label="Header actions"
          style={{
            marginTop: 'var(--space-2)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--colour-border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            alignItems: 'center',
          }}
        >
          {cardLifecycleStatus && (
            <CardLifecycleActions
              requestId={requestId}
              groupId={groupId}
              groupSlug={groupSlug}
              status={cardLifecycleStatus}
              currentColumnId={currentColumnId}
              activeColumns={activeColumns}
              variant="surface-2"
            />
          )}
          {canDelete && <DeleteTicketButton requestId={requestId} groupSlug={groupSlug} />}
        </div>
      )}
    </aside>
  );
}
