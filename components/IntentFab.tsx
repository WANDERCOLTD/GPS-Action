'use client';

/**
 * @build-unit BU-fab-intent-picker
 * @spec architecture/decision-log.md (D044, D061, D062)
 *
 * Single primary FAB → tile picker. Replaces every "create something
 * new" entry point in the app. Tap → modal/sheet with 11 tiles → 1-tap
 * to the right composer with intent-specific defaults.
 *
 * Per D061 the FAB is a single tap target. Each tile is its own tap
 * target. Disabled tiles render but don't dispatch (visible affordance
 * for "coming soon" features).
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Plus,
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
} from 'lucide-react';

interface Tile {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: ReactNode;
  accent: string;
  disabled?: boolean;
}

const TILES: Tile[] = [
  {
    key: 'happening_now',
    label: 'Urgent — happening now',
    hint: 'Posts with a red alert flag; reviewers see it instantly',
    href: '/compose?intent=happening_now',
    icon: <AlertTriangle size={24} />,
    accent: 'var(--colour-urgent)',
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
    label: "I don't know",
    hint: 'Open the composer with a kind selector at the top',
    href: '/compose?intent=undecided',
    icon: <HelpCircle size={24} />,
    accent: 'var(--colour-text-secondary)',
  },
];

const fabStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'var(--space-6)',
  right: 'var(--space-6)',
  width: 56,
  height: 56,
  borderRadius: 'var(--radius-circle)',
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 16px color-mix(in srgb, var(--colour-primary) 35%, transparent)',
  border: 'none',
  cursor: 'pointer',
  zIndex: 100,
};

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

export function IntentFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create something new"
        data-testid="intent-fab-button"
        style={fabStyle}
      >
        <Plus size={28} aria-hidden="true" strokeWidth={2.5} />
      </button>

      {open && (
        <div style={sheetBackdrop} onClick={() => setOpen(false)} data-testid="intent-fab-backdrop">
          <div
            style={sheetStyle}
            role="dialog"
            aria-label="What would you like to share?"
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
                What would you like to share?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
              {TILES.map((tile) => (
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
                  ) : (
                    <Link
                      href={tile.href}
                      data-testid="intent-tile-link"
                      data-intent-key={tile.key}
                      onClick={() => setOpen(false)}
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
      )}
    </>
  );
}

function tileStyleBase(accent: string, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--colour-surface-raised)',
    border: `1px solid var(--colour-border-subtle)`,
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
