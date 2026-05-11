/**
 * @build-unit bu-network-zoom-card
 *
 * Pure parser for a Zoom meeting invitation body as it arrives via
 * WhatsApp (per Grant's pipe). Zoom invites are ~25-line walls of
 * text that include the join URL, meeting ID, passcode, dial-in
 * numbers, calendar import URL, etc. Rendering the wall verbatim
 * makes for a bad card — instead, lift the structured bits out so
 * the card can show a clean "Join meeting" CTA + collapsible details.
 *
 * Conservative regex extraction (no heuristics that could mis-grab
 * unrelated text). Anything missing is returned as null; the
 * renderer falls back gracefully on the standard LinkPreviewCard
 * shape.
 *
 * Lives in `/shared/lib/` so both server and client can consume it
 * without crossing layer boundaries. Pure functions, no I/O.
 */

export interface ZoomInvitation {
  /** First Zoom join URL found (`https://*.zoom.us/j/<id>(?pwd=…)`). */
  joinUrl: string | null;
  /** Meeting topic — text on the line after `Topic:`. */
  topic: string | null;
  /** Time line as-printed by Zoom (`Time: May 11, 2026 06:45 PM London`). */
  time: string | null;
  /** Meeting ID — digits in the `Meeting ID: 857 0833 6781` line. */
  meetingId: string | null;
  /** Passcode value after `Passcode:`. */
  passcode: string | null;
  /**
   * Recurrence summary if present (`Every week on Mon, 106 occurrences`).
   * Null for one-off meetings.
   */
  recurrence: string | null;
}

const JOIN_URL_RE = /https?:\/\/[a-z0-9-]+\.zoom\.us\/j\/\d+(?:\?pwd=[\w.-]+)?/i;
const TOPIC_RE = /^\s*Topic:\s*(.+?)\s*$/im;
const TIME_RE = /^\s*Time:\s*(.+?)\s*$/im;
const RECURRENCE_RE = /^\s*Every\s+\w+\s+on\s+.+$/im;
const MEETING_ID_RE = /Meeting\s*ID:\s*([\d\s]+?)(?:\n|$)/i;
const PASSCODE_RE = /Passcode:\s*(\S+)/i;

/**
 * Parse a Zoom invitation body. Returns a fully-populated
 * `ZoomInvitation` with `null` for any field that couldn't be
 * extracted — never throws.
 */
export function parseZoomInvitation(body: string | null | undefined): ZoomInvitation {
  if (!body) {
    return {
      joinUrl: null,
      topic: null,
      time: null,
      meetingId: null,
      passcode: null,
      recurrence: null,
    };
  }
  const joinMatch = body.match(JOIN_URL_RE);
  const topicMatch = body.match(TOPIC_RE);
  const timeMatch = body.match(TIME_RE);
  const recurrenceMatch = body.match(RECURRENCE_RE);
  const meetingIdMatch = body.match(MEETING_ID_RE);
  const passcodeMatch = body.match(PASSCODE_RE);

  return {
    joinUrl: joinMatch?.[0] ?? null,
    topic: topicMatch?.[1]?.trim() ?? null,
    time: timeMatch?.[1]?.trim() ?? null,
    meetingId: meetingIdMatch?.[1]?.trim() ?? null,
    passcode: passcodeMatch?.[1]?.trim() ?? null,
    recurrence: recurrenceMatch?.[0]?.trim() ?? null,
  };
}

/**
 * Returns true when the URL hostname is a Zoom meeting domain
 * (`zoom.us` or any subdomain — e.g. `us06web.zoom.us`). Used by
 * NetworkCard to branch to the ZoomMeetingCard variant.
 */
export function isZoomUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return host === 'zoom.us' || host.endsWith('.zoom.us');
  } catch {
    return false;
  }
}
