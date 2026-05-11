/**
 * Unit tests for the Zoom invitation parser.
 *
 * @build-unit bu-network-zoom-card
 *
 * Fixture lifted from a real WhatsApp message that surfaced on
 * /network during testing (Zoom invite from Jeremy Woolfff, 11 May
 * 2026). Pure function — no I/O, no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { parseZoomInvitation, isZoomUrl } from '@/shared/lib/parse-zoom-invitation';

const REAL_INVITATION = `Jeremy Woolfff GPS is inviting you to a scheduled Zoom meeting.

Topic: NEWS WRITERS - GPS's Zoom Meeting
Time: May 11, 2026 06:45 PM London
        Every week on Mon, 106 occurrence(s)
Please download and import the following iCalendar (.ics) files to your calendar system.
Weekly: https://us06web.zoom.us/meeting/FAKE_MEETING_REF/ics?icsToken=FAKE_TOKEN_FOR_TEST

Join Zoom Meeting
https://us06web.zoom.us/j/85708336781?pwd=672045

Meeting chat link
https://us06web.zoom.us/launch/jc/85708336781

Meeting ID: 857 0833 6781
Passcode: 672045

---

One tap mobile
+15074734847,,85708336781#,,,,,,0#,,672045# US
+15642172000,,85708336781#,,,,,,0#,,672045# US

---

Join by SIP
85708336781@zoomcrc.com

Join instructions
https://us06web.zoom.us/meetings/85708336781/invitation?h=AbCdEfGhIjKlMnOpQrSt`;

describe('parseZoomInvitation', () => {
  it('extracts every structured field from a real invitation body', () => {
    const result = parseZoomInvitation(REAL_INVITATION);

    expect(result.joinUrl).toBe('https://us06web.zoom.us/j/85708336781?pwd=672045');
    expect(result.topic).toBe("NEWS WRITERS - GPS's Zoom Meeting");
    expect(result.time).toBe('May 11, 2026 06:45 PM London');
    expect(result.meetingId).toBe('857 0833 6781');
    expect(result.passcode).toBe('672045');
    expect(result.recurrence).toMatch(/Every week on Mon/);
  });

  it('returns all-null for empty / null / undefined input', () => {
    const empty = parseZoomInvitation('');
    expect(empty.joinUrl).toBeNull();
    expect(empty.topic).toBeNull();

    expect(parseZoomInvitation(null).joinUrl).toBeNull();
    expect(parseZoomInvitation(undefined).joinUrl).toBeNull();
  });

  it('returns nulls for fields that are missing in a partial body', () => {
    const partial = parseZoomInvitation(
      'Hey come to the meeting: https://us06web.zoom.us/j/123456789?pwd=abcdef',
    );
    expect(partial.joinUrl).toBe('https://us06web.zoom.us/j/123456789?pwd=abcdef');
    expect(partial.topic).toBeNull();
    expect(partial.time).toBeNull();
    expect(partial.meetingId).toBeNull();
    expect(partial.passcode).toBeNull();
  });

  it('does not match non-Zoom URLs for joinUrl', () => {
    const result = parseZoomInvitation(
      'Topic: Decoy\nJoin: https://teams.microsoft.com/l/meetup-join/abc',
    );
    expect(result.joinUrl).toBeNull();
    expect(result.topic).toBe('Decoy');
  });

  it('captures join URLs without a passcode (older-style invites)', () => {
    const result = parseZoomInvitation(
      'Topic: Open meeting\nJoin Zoom Meeting\nhttps://us02web.zoom.us/j/1234567890',
    );
    expect(result.joinUrl).toBe('https://us02web.zoom.us/j/1234567890');
    expect(result.passcode).toBeNull();
  });

  it('extracts topic with punctuation and spaces correctly', () => {
    const result = parseZoomInvitation('Topic: Coordinators only — weekly call (UK + EU)');
    expect(result.topic).toBe('Coordinators only — weekly call (UK + EU)');
  });

  it('extracts meeting ID with internal whitespace preserved', () => {
    const result = parseZoomInvitation('Meeting ID: 123 4567 8910');
    expect(result.meetingId).toBe('123 4567 8910');
  });
});

describe('isZoomUrl', () => {
  it('matches the apex zoom.us domain', () => {
    expect(isZoomUrl('https://zoom.us/j/123')).toBe(true);
  });

  it('matches regional subdomains (us06web, us02web, etc.)', () => {
    expect(isZoomUrl('https://us06web.zoom.us/j/123')).toBe(true);
    expect(isZoomUrl('https://us02web.zoom.us/j/123')).toBe(true);
  });

  it('matches "www." prefixed forms', () => {
    expect(isZoomUrl('https://www.zoom.us/')).toBe(true);
  });

  it('rejects non-zoom hosts', () => {
    expect(isZoomUrl('https://example.com/zoom.us')).toBe(false);
    expect(isZoomUrl('https://zoomroom.com/')).toBe(false);
    expect(isZoomUrl('https://x.com/anything')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isZoomUrl('not-a-url')).toBe(false);
    expect(isZoomUrl('')).toBe(false);
  });
});
