/**
 * @build-unit BU-event-time
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Timezone + format helpers for structured event-time fields on Post.
 * Storage is UTC (Postgres `timestamp(3)`); rendering happens in
 * Europe/London at the UI boundary. Never construct local times via
 * raw `new Date()` arithmetic — DST edge cases (1:30am clock-change
 * weekends) silently corrupt timestamps without `date-fns-tz`.
 *
 * Layer boundary: `shared` may import only from `shared`. These
 * helpers are imported from both `app/**` (composer / PostCard /
 * edit form) and `server/services/**` (createPost / updatePost
 * normalisation) — both paths route through this single module.
 */

import { format, isValid } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const EVENT_TIMEZONE = 'Europe/London';

/**
 * Convert a "wall-clock in Europe/London" date+time pair (as the user
 * typed in the composer) to a UTC `Date` for persistence.
 *
 * Inputs:
 *  - `dateStr`: yyyy-MM-dd (HTML `<input type="date">` value)
 *  - `timeStr`: HH:mm     (HTML `<input type="time">` value)
 *
 * Returns null on empty / invalid input. The composer / edit page
 * call this with whatever the form's hidden `eventAtDate` /
 * `eventAtTime` inputs contained; null = "no event time set".
 */
export function eventInputToUtc(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
): Date | null {
  if (!dateStr) return null;
  const time = timeStr && timeStr.trim() !== '' ? timeStr.trim() : '00:00';
  // Build the local wall-clock string in ISO format Europe/London
  // expects: `yyyy-MM-ddTHH:mm:00`.
  const local = `${dateStr.trim()}T${time}:00`;
  let utc: Date;
  try {
    utc = fromZonedTime(local, EVENT_TIMEZONE);
  } catch {
    return null;
  }
  return isValid(utc) ? utc : null;
}

/**
 * Convert a UTC `Date` (or null) to the `{ date, time }` strings the
 * composer's date+time inputs expect — both expressed in Europe/London
 * wall-clock. Returns empty strings on null so the controlled inputs
 * render cleanly.
 */
export function utcToEventInput(utc: Date | null | undefined): { date: string; time: string } {
  if (!utc) return { date: '', time: '' };
  if (!isValid(utc)) return { date: '', time: '' };
  return {
    date: formatInTimeZone(utc, EVENT_TIMEZONE, 'yyyy-MM-dd'),
    time: formatInTimeZone(utc, EVENT_TIMEZONE, 'HH:mm'),
  };
}

/**
 * Render a UTC `Date` as a human-friendly absolute string, in
 * Europe/London. Used by PostCard for the prominent event-time row.
 *
 * Examples (en-GB):
 *  - "Sat 3 May · 6pm"
 *  - "Sat 3 May · 6:30pm"
 *  - "Mon 12 May · 11am"
 *
 * Hour shown as 12-hour with am/pm because the demo audience reads
 * casual prose ("Sunday at 6pm"), not 24-hour timetables. See open
 * decisions in the PR description.
 */
export function formatEventStart(utc: Date | null | undefined): string {
  if (!utc || !isValid(utc)) return '';
  return formatInTimeZone(utc, EVENT_TIMEZONE, 'EEE d MMM · ' + buildHourFormat(utc));
}

/**
 * Render a UTC `Date` range as a human-friendly absolute string, in
 * Europe/London. Single-day ranges collapse the date:
 *
 *  - "Sat 3 May · 6–8pm"
 *  - "Sat 3 May · 6:30–8:30pm"
 *
 * Multi-day ranges spell both ends:
 *
 *  - "Sat 3 May 6pm – Sun 4 May 9am"
 *
 * `null` / invalid `endsAt` falls back to `formatEventStart(at)`.
 */
export function formatEventRange(
  at: Date | null | undefined,
  endsAt: Date | null | undefined,
): string {
  if (!at || !isValid(at)) return '';
  if (!endsAt || !isValid(endsAt)) return formatEventStart(at);

  const startDate = formatInTimeZone(at, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const endDate = formatInTimeZone(endsAt, EVENT_TIMEZONE, 'yyyy-MM-dd');
  const sameDay = startDate === endDate;

  if (sameDay) {
    const dateLabel = formatInTimeZone(at, EVENT_TIMEZONE, 'EEE d MMM');
    const startHour = formatInTimeZone(at, EVENT_TIMEZONE, buildHourFormat(at));
    const endHour = formatInTimeZone(endsAt, EVENT_TIMEZONE, buildHourFormat(endsAt));
    // BU-event-time / D073: collapse "6pm–8pm" → "6–8pm" when both
    // halves share the same am/pm marker. Matches the brief's UI-state
    // table example. Different markers (e.g. "11am–1pm") spell both.
    const startMarker = startHour.endsWith('pm') ? 'pm' : startHour.endsWith('am') ? 'am' : '';
    const endMarker = endHour.endsWith('pm') ? 'pm' : endHour.endsWith('am') ? 'am' : '';
    if (startMarker && startMarker === endMarker) {
      const startStripped = startHour.slice(0, -startMarker.length);
      return `${dateLabel} · ${startStripped}–${endHour}`;
    }
    return `${dateLabel} · ${startHour}–${endHour}`;
  }

  const startLabel =
    formatInTimeZone(at, EVENT_TIMEZONE, 'EEE d MMM ') +
    formatInTimeZone(at, EVENT_TIMEZONE, buildHourFormat(at));
  const endLabel =
    formatInTimeZone(endsAt, EVENT_TIMEZONE, 'EEE d MMM ') +
    formatInTimeZone(endsAt, EVENT_TIMEZONE, buildHourFormat(endsAt));
  return `${startLabel} – ${endLabel}`;
}

/**
 * Returns the `date-fns` format token for the hour portion of an
 * event time, choosing between "ha" (e.g. "6pm") when minutes are
 * zero and "h:mma" (e.g. "6:30pm") otherwise. Lowercase am/pm via a
 * post-format pass — `date-fns` produces "AM"/"PM" by default and
 * the demo voice prefers the lowercase form.
 */
function buildHourFormat(utc: Date): string {
  const minutes = Number(formatInTimeZone(utc, EVENT_TIMEZONE, 'm'));
  return minutes === 0 ? 'haaa' : 'h:mmaaa';
}

/**
 * Compute the "today 00:00 in Europe/London" cutoff used by the
 * `listUpcoming` query. We anchor on the caller's *current moment*
 * (passed in to keep the function pure / testable) and walk back to
 * the start of the same Europe/London calendar day. Returned as a
 * UTC `Date` ready to drop straight into Prisma's `gte`.
 */
export function todayStartLondonUtc(now: Date = new Date()): Date {
  const dateStr = formatInTimeZone(now, EVENT_TIMEZONE, 'yyyy-MM-dd');
  // Re-zone yyyy-MM-dd at 00:00 Europe/London → UTC.
  return fromZonedTime(`${dateStr}T00:00:00`, EVENT_TIMEZONE);
}

/**
 * Lightweight escape hatch for code paths that already have a
 * Europe/London-rendered string and want to reformat with a custom
 * `date-fns` token. Re-exported so callers don't reach into the
 * `date-fns-tz` package directly and so the timezone constant stays
 * authoritative here.
 */
export function formatLondon(utc: Date, fmt: string): string {
  return formatInTimeZone(utc, EVENT_TIMEZONE, fmt);
}

/**
 * Re-export `format` from `date-fns` for callers that have already
 * converted to Europe/London local. Discourages naked `format()`
 * imports outside this module so the timezone discipline stays
 * visible at the import boundary.
 */
export { format as formatLocal };
