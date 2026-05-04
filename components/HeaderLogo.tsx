/**
 * @build-unit BU-sticky-nav
 * @spec architecture/decision-log.md (D065)
 *
 * GPS Action brand mark in the sticky header. Clickable, routes to
 * /capabilities (the SRS showcase landing page).
 *
 * Renders the cropped pin from the brand artwork (`gps-logo-mark.png`).
 * The full wordmark version lives at `public/brands/gps-logo.png` for
 * use on landing pages where the "GPS" lettering is large enough to
 * read; in the sticky header the mark-only crop avoids unreadable
 * micro-type. Colours are baked into the PNG, so this asset does not
 * invert in dark mode — accepted tradeoff for brand fidelity.
 *
 * Sized to match the surrounding 22px lucide nav glyphs (sits in the
 * same row as `<AppNav>` icons). Both width and height are set in the
 * style block so the rendered img cannot exceed the row height.
 */
import Image from 'next/image';
import Link from 'next/link';

const HEIGHT = 28;
const WIDTH = 23;

export function HeaderLogo() {
  return (
    <Link
      href="/capabilities"
      data-testid="nav-header-logo"
      aria-label="GPS Action — capabilities overview"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-1) var(--space-2)',
        textDecoration: 'none',
        lineHeight: 0,
      }}
    >
      <Image
        src="/brands/gps-logo-mark.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
        style={{
          display: 'block',
          width: WIDTH,
          height: HEIGHT,
          objectFit: 'contain',
        }}
      />
    </Link>
  );
}
