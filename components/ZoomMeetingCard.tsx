/**
 * @build-unit bu-network-zoom-card
 * @spec product/design-philosophy.md
 *
 * Per-host card variant for `zoom.us` meeting invitations.
 *
 * Zoom invitations arrive via Grant's pipe as ~25-line walls of text:
 * meeting topic, weekly recurrence summary, calendar-import URL,
 * join URL, meeting ID, passcode, dial-in numbers, SIP join info.
 * The default LinkPreviewCard fallback renders the entire body
 * verbatim because Zoom's meeting pages auth-wall their OG metadata
 * — the result is a useless wall of text.
 *
 * This component lifts the structured bits out via
 * `parseZoomInvitation`, then renders:
 *
 *   - A primary "Join meeting →" CTA on the join URL.
 *   - A subtitle line: topic · time · (forwarded?).
 *   - A collapsed "Meeting details" `<details>` revealing meeting
 *     ID + passcode + the raw body for members who need the dial-in.
 *
 * F14 testid rule: every member-actionable element carries a stable
 * `data-testid` rooted on `messageId` for unique selection.
 *
 * Honest-copy posture: the CTA reads "Join meeting →" not
 * "Open Zoom" — we're not opening Zoom for them, we're navigating
 * to a meeting they then have to confirm-join client-side.
 *
 * Note: this card is presentational only. The clickable join target
 * is rendered as a regular `<a target="_blank">`; share / triage /
 * reaction affordances stay in the parent NetworkCard.
 */

import type { CSSProperties, ReactElement } from 'react';
import * as React from 'react';
import { Video } from 'lucide-react';
import type { ZoomInvitation } from '@/shared/lib/parse-zoom-invitation';

void React;

interface ZoomMeetingCardProps {
  /** Raw message URL (the upstream join URL). Used as fallback when the parsed joinUrl is null. */
  linkUrl: string;
  /** Parsed invitation fields. Any field can be null. */
  invitation: ZoomInvitation;
  /** Raw message body. Rendered inside the collapsed "Meeting details" section. */
  rawBody: string | null;
  /** The networkCard messageId, used as a data attribute root for testids. */
  messageId: string;
}

const HERO_BACKGROUND =
  // Soft Zoom-blue tint without hard-coding the brand colour — uses
  // our primary token so the card stays on-system across themes.
  'color-mix(in srgb, var(--colour-primary-subtle) 80%, var(--colour-surface-raised))';

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginTop: 'var(--space-3)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};

const heroStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 6',
  background: HERO_BACKGROUND,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--colour-primary)',
};

const bodyStyle: CSSProperties = {
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 'var(--text-2xs)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'var(--colour-text-secondary)',
  fontWeight: 600,
};

const topicStyle: CSSProperties = {
  fontSize: 'var(--text-md)',
  fontWeight: 600,
  color: 'var(--colour-text-primary)',
  margin: 0,
  lineHeight: 'var(--line-tight)',
};

const metaLineStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  margin: 0,
};

const joinButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-pill)',
  textDecoration: 'none',
  alignSelf: 'flex-start',
  marginTop: 'var(--space-1)',
};

const detailsStyle: CSSProperties = {
  marginTop: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: 'var(--colour-text-link)',
  fontWeight: 500,
  // Hide the default disclosure triangle so the toggle reads as a
  // chip-like text affordance, matching the rest of /network's
  // visual register.
  listStyle: 'none' as const,
};

const credLineStyle: CSSProperties = {
  margin: 0,
  marginTop: 'var(--space-1)',
};

const rawBodyStyle: CSSProperties = {
  marginTop: 'var(--space-3)',
  padding: 'var(--space-2)',
  background: 'var(--colour-surface-sunken)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-tertiary)',
  whiteSpace: 'pre-wrap' as const,
  overflowWrap: 'anywhere' as const,
  maxHeight: 280,
  overflowY: 'auto' as const,
};

export function ZoomMeetingCard({
  linkUrl,
  invitation,
  rawBody,
  messageId,
}: ZoomMeetingCardProps): ReactElement {
  // Join target — prefer the parsed Zoom URL (more specific) but fall
  // back to the message's original URL if the regex missed.
  const joinHref = invitation.joinUrl ?? linkUrl;
  const hasCredentials = Boolean(invitation.meetingId || invitation.passcode || rawBody);
  const metaParts: string[] = [];
  if (invitation.time) metaParts.push(invitation.time);
  if (invitation.recurrence) metaParts.push(invitation.recurrence);
  const metaLine = metaParts.join(' · ');

  return (
    <article data-testid="network-zoom-card" data-message-id={messageId} style={containerStyle}>
      <div style={heroStyle} aria-hidden="true">
        <Video size={48} strokeWidth={1.5} />
      </div>
      <div style={bodyStyle}>
        <span style={eyebrowStyle}>Zoom meeting</span>
        {invitation.topic && (
          <h3 data-testid="network-zoom-card-topic" style={topicStyle}>
            {invitation.topic}
          </h3>
        )}
        {metaLine && (
          <p data-testid="network-zoom-card-meta" style={metaLineStyle}>
            {metaLine}
          </p>
        )}
        <a
          href={joinHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="network-zoom-card-join"
          data-message-id={messageId}
          style={joinButtonStyle}
        >
          Join meeting →
        </a>
        {hasCredentials && (
          <details data-testid="network-zoom-card-details" style={detailsStyle}>
            <summary style={summaryStyle}>Meeting details</summary>
            {invitation.meetingId && (
              <p data-testid="network-zoom-card-meeting-id" style={credLineStyle}>
                <strong>Meeting ID:</strong> {invitation.meetingId}
              </p>
            )}
            {invitation.passcode && (
              <p data-testid="network-zoom-card-passcode" style={credLineStyle}>
                <strong>Passcode:</strong> {invitation.passcode}
              </p>
            )}
            {rawBody && (
              <pre data-testid="network-zoom-card-raw-body" style={rawBodyStyle}>
                {rawBody}
              </pre>
            )}
          </details>
        )}
      </div>
    </article>
  );
}
