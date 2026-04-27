/**
 * @build-unit BU-link-share BU-am-link-collapse
 * @spec architecture/decision-log.md (D060, D061)
 * @spec product/scenarios.md (SCN-19)
 * @spec product/image-handling.md
 * @spec build/session-briefs/bu-am-link-collapse.md
 *
 * Monolithic link preview card. One <a> tap target per D061.
 * Used for both linkUrl shares (Sharon's Guardian article) and
 * activistMailerUrl actions (the AM brand mark flips on via
 * isAmAction). Two sizes: small for collapsed feed cards, large
 * for expanded views and post detail pages.
 *
 * BU-am-link-collapse: when `isAmAction` is undefined, the card
 * auto-detects from `linkUrl` against the Activist-Mailer domain
 * allowlist. Explicit `true`/`false` from the caller overrides
 * detection (preserves the legacy AM-render path). The CTA at
 * the bottom of the card reads "Send email →" for AM links and
 * "Open link →" otherwise.
 *
 * Falls back gracefully:
 *   - missing title → URL host (truncated)
 *   - missing image → type-keyed placeholder block
 *   - missing site name → URL host
 *   - missing description → omitted
 */

import type { CSSProperties, ReactElement } from 'react';
import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { isActivistMailerDomain } from '@/shared/validation/am-domain';

void React;

export type LinkPreviewSize = 'small' | 'large';

interface LinkPreviewCardProps {
  linkUrl: string;
  linkTitle?: string | null;
  linkDescription?: string | null;
  linkImageUrl?: string | null;
  linkSiteName?: string | null;
  size: LinkPreviewSize;
  /**
   * Override the AM brand-mark + CTA. When undefined, the card
   * infers from `linkUrl` via the Activist-Mailer domain
   * allowlist (BU-am-link-collapse).
   */
  isAmAction?: boolean;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Returns the path + query + hash portion of a URL, or null if the URL
 * has no meaningful path component (e.g. `https://example.com/`). Used
 * by the large-variant fallback so the title row shows DIFFERENT info
 * from the site row (which already shows the host).
 */
function pathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const tail = `${u.pathname}${u.search}${u.hash}`;
    if (tail === '' || tail === '/') return null;
    return tail;
  } catch {
    return null;
  }
}

export function LinkPreviewCard({
  linkUrl,
  linkTitle,
  linkDescription,
  linkImageUrl,
  linkSiteName,
  size,
  isAmAction,
}: LinkPreviewCardProps): ReactElement {
  const host = hostFromUrl(linkUrl);
  const isLarge = size === 'large';

  // Host-duplication dedup (BU-link-preview-dedup):
  //
  // When a post has a linkUrl but neither linkTitle nor linkSiteName, the
  // naive fallback (`host` for both rows) prints the host twice. The two
  // size variants resolve this differently:
  //
  // small: drop the site row entirely — show only the host as the title.
  // large: keep the site row (it's the primary identification) and use
  //        the URL pathname as the title so each row shows DIFFERENT
  //        info. If pathname is "/" or empty, fall back to the full URL
  //        string for the title row.
  //
  // When linkTitle IS set, behaviour is unchanged.
  const trimmedTitle = linkTitle?.trim();
  const trimmedSite = linkSiteName?.trim();
  const titleMissing = !trimmedTitle;
  const siteMissing = !trimmedSite;

  let displayTitle: string;
  let showSiteRow: boolean;
  let displaySite: string;

  if (!titleMissing) {
    // Title set: render both rows as today.
    displayTitle = trimmedTitle;
    showSiteRow = true;
    displaySite = trimmedSite || host;
  } else if (siteMissing) {
    // Both title AND site name missing — dedup.
    if (isLarge) {
      // Large: site row keeps host, title row shows pathname (or full
      // URL if pathname is "/" or empty).
      showSiteRow = true;
      displaySite = host;
      displayTitle = pathFromUrl(linkUrl) ?? linkUrl;
    } else {
      // Small: drop the site row, host becomes the title.
      showSiteRow = false;
      displaySite = host;
      displayTitle = host;
    }
  } else {
    // Title missing, site name present — host fills the title row, site
    // name fills the site row. No duplication, no change in behaviour.
    showSiteRow = true;
    displaySite = trimmedSite;
    displayTitle = host;
  }
  // Auto-detect AM domain when caller didn't explicitly override.
  const amAction = isAmAction ?? isActivistMailerDomain(linkUrl);
  const ctaLabel = amAction ? 'Send email →' : 'Open link →';

  const containerStyle: CSSProperties = isLarge
    ? {
        display: 'flex',
        flexDirection: 'column',
        marginTop: 'var(--space-3)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
      }
    : {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginTop: 'var(--space-2)',
        background: 'var(--colour-surface-raised)',
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        minHeight: 96,
      };

  const imageStyle: CSSProperties = isLarge
    ? {
        width: '100%',
        aspectRatio: '16 / 9',
        background: 'var(--colour-surface-sunken)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundImage: linkImageUrl ? `url(${JSON.stringify(linkImageUrl)})` : undefined,
        flexShrink: 0,
      }
    : {
        width: 96,
        aspectRatio: '1 / 1',
        background: 'var(--colour-surface-sunken)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundImage: linkImageUrl ? `url(${JSON.stringify(linkImageUrl)})` : undefined,
        flexShrink: 0,
      };

  const bodyStyle: CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: isLarge ? 'var(--text-md)' : 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--colour-text-primary)',
    margin: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: isLarge ? 3 : 2,
    WebkitBoxOrient: 'vertical' as const,
  };

  const descriptionStyle: CSSProperties | undefined = linkDescription
    ? {
        fontSize: 'var(--text-xs)',
        color: 'var(--colour-text-secondary)',
        margin: 0,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: isLarge ? 4 : 2,
        WebkitBoxOrient: 'vertical' as const,
      }
    : undefined;

  const siteRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontSize: 'var(--text-2xs)',
    color: 'var(--colour-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginTop: 'auto',
  };

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={containerStyle}
      data-testid="link-preview-card"
      data-link-url={linkUrl}
      data-size={size}
      data-am-action={amAction || undefined}
    >
      <div style={imageStyle} aria-hidden="true" />
      <div style={bodyStyle}>
        {showSiteRow && (
          <div style={siteRowStyle}>
            <span>{displaySite}</span>
            <ExternalLink size={11} aria-hidden="true" />
          </div>
        )}
        <h3 style={titleStyle}>{displayTitle}</h3>
        {linkDescription && <p style={descriptionStyle}>{linkDescription}</p>}
        <span
          data-testid="link-preview-card-cta"
          data-am-action={amAction || undefined}
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: amAction ? 'var(--colour-primary)' : 'var(--colour-text-link)',
          }}
        >
          {ctaLabel}
        </span>
      </div>
      {amAction && (
        <span
          aria-label="Activist Mailer action"
          data-testid="link-preview-card-am-mark"
          style={{
            position: 'absolute',
            top: 'var(--space-2)',
            right: 'var(--space-2)',
            background: 'var(--colour-primary)',
            color: 'var(--colour-primary-contrast)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-pill)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
          }}
        >
          AM
        </span>
      )}
    </a>
  );
}
