/**
 * @build-unit BU-sticky-nav
 * @spec architecture/decision-log.md (D065)
 *
 * GPS Action brand mark in the sticky header. Clickable, routes to /feed.
 *
 * Three SVG layers, two colours:
 *   1. Brand-colour tile (rounded square)
 *   2. Contrast-colour pin teardrop + inner brand-colour cutout (the ring)
 *   3. Contrast-colour Star of David on top
 *
 * Colours follow the existing semantic token pair `--colour-primary` /
 * `--colour-primary-contrast`, so the mark inverts cleanly between light
 * and dark themes. The exact navy from gpsnet.org isn't a token yet — if
 * we want to land it precisely, that's a separate token PR per
 * docs/process/design-tokens-convention.md.
 */
import Link from 'next/link';

const TILE = 'var(--colour-primary)';
const MARK = 'var(--colour-primary-contrast)';

export function HeaderLogo() {
  return (
    <Link
      href="/feed"
      data-testid="nav-header-logo"
      aria-label="GPS Action — go to feed"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-1) var(--space-2)',
        textDecoration: 'none',
        lineHeight: 0,
      }}
    >
      <svg
        viewBox="0 0 32 40"
        width={26}
        height={32}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="32" height="40" rx="4" fill={TILE} />
        <g transform="translate(4 4)">
          <path fill={MARK} d="M12 32 L19.2 21.6 A12 12 0 1 0 4.8 21.6 Z" />
          <path fill={TILE} d="M12 30 L17.7 20.7 A10 10 0 1 0 6.3 20.7 Z" />
          <path
            fill={MARK}
            d="M12 6.5 L17.2 15.5 L6.8 15.5 Z M12 18.5 L6.8 9.5 L17.2 9.5 Z"
          />
        </g>
      </svg>
    </Link>
  );
}
