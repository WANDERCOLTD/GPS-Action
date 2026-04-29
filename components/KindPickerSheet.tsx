'use client';

/**
 * @build-unit BU-fab-intent-picker BU-composer
 * @spec architecture/decision-log.md (D044, D061, D062)
 *
 * Bottom-sheet kind picker. Two callers:
 *   - IntentFab: triggered by the global FAB button. Each tile is a
 *     Link to /compose?intent=<slug>.
 *   - PostForm IntentBanner: triggered by tapping the form banner.
 *     Each tile fires onPick(slug) so the open form can flip its
 *     intent client-side without losing typed contents.
 *
 * The same sheet component is used in both places per the mobile
 * pattern: members learn one picker, recognise it everywhere.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  X,
  AlertTriangle,
  Link as LinkIcon,
  Megaphone,
  Feather,
  Pin,
  MessageCircle,
  CalendarDays,
  Users,
  Flag,
  Pencil,
  HelpCircle,
  CheckSquare,
} from 'lucide-react';

export interface Tile {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: ReactNode;
  accent: string;
  disabled?: boolean;
}

export const TILES: Tile[] = [
  {
    key: 'happening_now',
    label: 'Urgent — happening now',
    hint: 'Posts with a red alert flag; reviewers see it instantly',
    href: '/compose?intent=happening_now',
    icon: <AlertTriangle size={24} />,
    accent: 'var(--colour-urgent)',
  },
  // BU-tick-or-cross (D069): publishes to the GPS Network channel as
  // part of submit. Sortable above general kinds, below the alert tile.
  {
    key: 'tick_or_cross',
    label: '✅ or ❌',
    hint: 'Amplify or flag — sends to the GPS Network channel',
    href: '/compose?intent=tick_or_cross',
    icon: <CheckSquare size={24} />,
    accent: 'var(--colour-primary)',
  },
  {
    key: 'link_share',
    label: 'Share a link',
    hint: 'News, op-ed, article',
    href: '/compose?intent=link_share',
    icon: <LinkIcon size={24} />,
    accent: 'var(--colour-primary-bright)',
  },
  {
    key: 'call_to_action',
    label: 'Call to action',
    hint: 'Sign / send / contact',
    href: '/compose?intent=call_to_action',
    icon: <Megaphone size={24} />,
    accent: 'var(--colour-primary)',
  },
  {
    key: 'cultural',
    label: 'Cultural moment',
    hint: 'Shabbat, remembrance, celebration',
    href: '/compose?intent=cultural',
    icon: <Feather size={24} />,
    accent: 'var(--colour-cultural)',
  },
  {
    key: 'outcome',
    label: 'Outcome — what happened',
    hint: 'Closing the loop on an action',
    href: '/compose?intent=outcome',
    icon: <Pin size={24} />,
    accent: 'var(--colour-success)',
  },
  {
    key: 'thought',
    label: 'Just a thought',
    hint: 'Discussion, observation',
    href: '/compose?intent=thought',
    icon: <MessageCircle size={24} />,
    accent: 'var(--colour-info)',
  },
  {
    key: 'event',
    label: 'Event',
    hint: 'Time-bound — date / time fields coming soon',
    href: '/compose?intent=event',
    icon: <CalendarDays size={24} />,
    accent: 'var(--colour-info)',
  },
  {
    key: 'meeting',
    label: 'Meeting',
    hint: 'Group meeting — date / time fields coming soon',
    href: '/compose?intent=meeting',
    icon: <Users size={24} />,
    accent: 'var(--colour-info)',
  },
  {
    key: 'flag',
    label: 'Flag a problem post',
    hint: 'Coming soon (BU-requests-vetting)',
    href: '#',
    icon: <Flag size={24} />,
    accent: 'var(--colour-text-secondary)',
    disabled: true,
  },
  {
    key: 'edit_request',
    label: 'Suggest an edit',
    hint: 'Coming soon (BU-requests-vetting)',
    href: '#',
    icon: <Pencil size={24} />,
    accent: 'var(--colour-text-secondary)',
    disabled: true,
  },
  {
    key: 'undecided',
    label: "I'll choose",
    hint: 'Pick the kind once you start writing',
    href: '/compose?intent=undecided',
    icon: <HelpCircle size={24} />,
    accent: 'var(--colour-text-secondary)',
  },
];

interface KindPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * If provided, picking a tile fires this instead of navigating. Used by
   * the in-form banner so typed content survives the kind switch.
   */
  onPick?: (slug: string) => void;
  /** Tile keys to exclude entirely (e.g. ['flag', 'edit_request']). */
  excludeKeys?: string[];
  /** Sheet heading override. */
  title?: string;
}

export function KindPickerSheet({
  open,
  onClose,
  onPick,
  excludeKeys,
  title = 'What would you like to share?',
}: KindPickerSheetProps) {
  // BU-feed-card-affordances — iOS ghost-click guard. Same shape as
  // IntentFabStarter and ReactionPill: the same tap that opens this
  // sheet synthesises a click that lands on the backdrop, closing it
  // immediately. 250ms gap covers iOS's synth-click window.
  //
  // Critical: parent always renders <KindPickerSheet open={…}>, so
  // this component is mounted at page-load. useState lazy init would
  // capture mount-time, not open-time. Use a ref + effect instead.
  const openedAtRef = useRef<number>(0);
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  if (!open) return null;

  const visible = excludeKeys?.length ? TILES.filter((t) => !excludeKeys.includes(t.key)) : TILES;
  const handleBackdropClick = (): void => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  return (
    <div style={sheetBackdrop} onClick={handleBackdropClick} data-testid="intent-fab-backdrop">
      <div
        style={sheetStyle}
        role="dialog"
        aria-label={title}
        data-testid="intent-fab-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h2
            className="gps-subtitle"
            style={{ margin: 0, flex: 1 }}
            data-testid="intent-fab-title"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            data-testid="intent-fab-close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-2)',
              color: 'var(--colour-text-secondary)',
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--space-3)',
          }}
          data-testid="intent-fab-tile-grid"
        >
          {visible.map((tile) => (
            <li key={tile.key}>
              {tile.disabled ? (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={tile.hint}
                  data-testid="intent-tile-disabled"
                  data-intent-key={tile.key}
                  style={{
                    ...tileStyleBase(tile.accent, true),
                    cursor: 'not-allowed',
                    opacity: 0.55,
                  }}
                >
                  <TileBody tile={tile} />
                </button>
              ) : onPick ? (
                <button
                  type="button"
                  data-testid="intent-tile-pick"
                  data-intent-key={tile.key}
                  onClick={() => {
                    onPick(tile.key);
                    onClose();
                  }}
                  style={tileStyleBase(tile.accent, false)}
                >
                  <TileBody tile={tile} />
                </button>
              ) : (
                <Link
                  href={tile.href}
                  data-testid="intent-tile-link"
                  data-intent-key={tile.key}
                  onClick={onClose}
                  style={tileStyleBase(tile.accent, false)}
                >
                  <TileBody tile={tile} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--colour-surface-overlay)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-canvas)',
  borderTopLeftRadius: 'var(--radius-lg)',
  borderTopRightRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-4) var(--space-6)',
  width: '100%',
  maxWidth: 720,
  maxHeight: '85vh',
  overflowY: 'auto',
};

function tileStyleBase(accent: string, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--colour-surface-raised)',
    borderTop: '1px solid var(--colour-border-subtle)',
    borderRight: '1px solid var(--colour-border-subtle)',
    borderBottom: '1px solid var(--colour-border-subtle)',
    borderLeft: `4px solid ${accent}`,
    textDecoration: 'none',
    color: 'inherit',
    textAlign: 'left' as const,
    width: '100%',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function TileBody({ tile }: { tile: Tile }) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: tile.accent,
        }}
      >
        {tile.icon}
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--colour-text-primary)' }}>
          {tile.label}
        </strong>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--colour-text-secondary)',
        }}
      >
        {tile.hint}
      </p>
    </>
  );
}
