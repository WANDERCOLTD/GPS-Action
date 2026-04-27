/**
 * @build-unit BU-secondary-cta-placeholders
 * @spec architecture/decision-log.md (D066 — proposed)
 *
 * Rail of secondary social CTAs (placeholders for now). Renders either as
 * a vertical column (right-rail on the post card) or a horizontal row
 * (top share-bar on the post detail page) per the `layout` prop.
 *
 * Ships before D066's Action[] schema lands — every post gets the same three
 * placeholder icons (X, Instagram, Facebook). Each icon is an <a> to the
 * platform homepage, which on mobile deep-links into the installed app.
 *
 * TODO: replace the hand-rolled SVGs with a proper icon set (e.g. simple-icons
 * via react-icons/si) once D066 picks a per-action `kind` enum and we know
 * which platforms / icon variants we actually need. Hand-rolled now to avoid
 * pulling a dep we'd just rip out.
 *
 * TODO: when D066 lands, drive this rail from `post.secondaryActions[]`
 * rather than a static placeholder list — and decide how the per-icon URL
 * is composed (share intent vs. open-platform vs. author's own profile).
 */

import type { FC, ReactElement } from 'react';

interface PlatformLink {
  platform: 'x' | 'instagram' | 'facebook';
  label: string;
  href: string;
  icon: ReactElement;
}

const ICON_SIZE = 16;

// Hand-rolled SVGs — single-path glyphs at 24px viewBox, scaled by ICON_SIZE.
// See TODO at top of file.
const X_ICON = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const INSTAGRAM_ICON = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FACEBOOK_ICON = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M13.5 22v-8.5h2.86l.43-3.32H13.5V8.06c0-.96.27-1.62 1.66-1.62h1.77V3.47A23.7 23.7 0 0 0 14.34 3.3c-2.56 0-4.31 1.56-4.31 4.43v2.45H7.16v3.32h2.87V22z" />
  </svg>
);

const PLATFORMS: PlatformLink[] = [
  { platform: 'x', label: 'Open on X', href: 'https://x.com/', icon: X_ICON },
  {
    platform: 'instagram',
    label: 'Open on Instagram',
    href: 'https://instagram.com/',
    icon: INSTAGRAM_ICON,
  },
  {
    platform: 'facebook',
    label: 'Open on Facebook',
    href: 'https://facebook.com/',
    icon: FACEBOOK_ICON,
  },
];

interface SecondaryCtaRailProps {
  /** Visual size — `card` for the feed, `detail` slightly larger. */
  size?: 'card' | 'detail';
  /** Stack direction. `vertical` for the right-rail; `horizontal` for a top-bar. */
  layout?: 'vertical' | 'horizontal';
}

export const SecondaryCtaRail: FC<SecondaryCtaRailProps> = ({
  size = 'card',
  layout = 'vertical',
}) => {
  const buttonSize = size === 'detail' ? 36 : 28;

  return (
    <nav
      data-testid="post-secondary-cta-rail"
      aria-label="Share this post on social"
      data-layout={layout}
      style={{
        display: 'flex',
        flexDirection: layout === 'horizontal' ? 'row' : 'column',
        gap: 'var(--space-2)',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {PLATFORMS.map(({ platform, label, href, icon }) => (
        <a
          key={platform}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          data-testid="post-secondary-cta"
          data-platform={platform}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: buttonSize,
            height: buttonSize,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--colour-surface-raised)',
            border: '1px solid var(--colour-border-subtle)',
            color: 'var(--colour-text-secondary)',
            textDecoration: 'none',
          }}
        >
          {icon}
        </a>
      ))}
    </nav>
  );
};
