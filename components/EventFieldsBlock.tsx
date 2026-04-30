'use client';

/**
 * @build-unit BU-event-time
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Shared event-time field block used by the composer and the
 * /post/[id]/edit form. Renders three inputs:
 *
 *  - Start date  (`<input type="date">`)
 *  - Start time  (`<input type="time">`)
 *  - End date    (optional, `<input type="date">`)
 *  - End time    (optional, `<input type="time">`)
 *  - Location    (`<input type="text">`, max 500 chars)
 *
 * Inputs are uncontrolled where they can be — the form-action
 * pattern lets FormData read native input values directly. The
 * component owns just enough state to (a) render an inline error
 * for the "end before start" cross-field invariant before submit
 * and (b) preserve typed values across kind toggles in the composer
 * (per Sharon-warmth — the brief calls this out explicitly).
 *
 * Names submitted via FormData:
 *  - eventAtDate     (yyyy-MM-dd or "")
 *  - eventAtTime     (HH:mm or "")
 *  - eventEndsAtDate (yyyy-MM-dd or "")
 *  - eventEndsAtTime (HH:mm or "")
 *  - locationText    (free text or "")
 *
 * The composer's server action assembles eventAt / eventEndsAt UTC
 * Dates from these via shared/format-event-time.eventInputToUtc.
 */

import { useState, useEffect, type CSSProperties } from 'react';

/**
 * BU-event-time / D073. Form-state lifted up so values survive kind
 * toggles in the composer (per Sharon-warmth — typing a date for a
 * meeting then switching to event keeps the date typed).
 */
export interface EventFieldsState {
  eventAtDate: string;
  eventAtTime: string;
  eventEndsAtDate: string;
  eventEndsAtTime: string;
  locationText: string;
}

export const EMPTY_EVENT_FIELDS_STATE: EventFieldsState = {
  eventAtDate: '',
  eventAtTime: '',
  eventEndsAtDate: '',
  eventEndsAtTime: '',
  locationText: '',
};

interface EventFieldsBlockProps {
  value: EventFieldsState;
  onChange: (next: EventFieldsState) => void;
  /** Server-side error keyed by field name, mirroring PostForm's pattern. */
  errors?: {
    eventAt?: string[];
    eventEndsAt?: string[];
    locationText?: string[];
  };
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

const errorStyle: CSSProperties = {
  color: 'var(--colour-danger)',
  fontSize: 'var(--text-xs)',
  marginTop: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

export function EventFieldsBlock({ value, onChange, errors = {} }: EventFieldsBlockProps) {
  const startDate = value.eventAtDate;
  const startTime = value.eventAtTime;
  const endDate = value.eventEndsAtDate;
  const endTime = value.eventEndsAtTime;
  const location = value.locationText;

  function patch(next: Partial<EventFieldsState>): void {
    onChange({ ...value, ...next });
  }

  // BU-event-time / D073. Cross-field invariant — surface a client-
  // side preview of the server's "end >= start" check. We only
  // compute it when both halves of each timestamp are present;
  // partial input doesn't trip the warning.
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!startDate || !endDate) {
      setRangeError(null);
      return;
    }
    const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
    const end = new Date(`${endDate}T${endTime || '00:00'}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setRangeError(null);
      return;
    }
    if (end < start) {
      setRangeError('End time must be the same as or after the start time.');
    } else {
      setRangeError(null);
    }
  }, [startDate, startTime, endDate, endTime]);

  const showServerEndsError = errors.eventEndsAt && errors.eventEndsAt.length > 0;

  return (
    <fieldset
      data-testid="compose-event-fields"
      style={{
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        margin: 0,
        background: 'var(--colour-surface-sunken)',
      }}
    >
      <legend
        style={{
          padding: '0 var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          fontFamily: 'var(--font-ui)',
          color: 'var(--colour-text-primary)',
        }}
      >
        When is it?
      </legend>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-2)',
        }}
      >
        <div>
          <label htmlFor="eventAtDate" data-testid="compose-event-at-date-label" style={labelStyle}>
            Start date
          </label>
          <input
            id="eventAtDate"
            name="eventAtDate"
            type="date"
            value={startDate}
            onChange={(e) => patch({ eventAtDate: e.target.value })}
            data-testid="compose-event-at-date"
            className="gps-input"
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label htmlFor="eventAtTime" data-testid="compose-event-at-time-label" style={labelStyle}>
            Start time
          </label>
          <input
            id="eventAtTime"
            name="eventAtTime"
            type="time"
            value={startTime}
            onChange={(e) => patch({ eventAtTime: e.target.value })}
            data-testid="compose-event-at-time"
            className="gps-input"
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {errors.eventAt && errors.eventAt.length > 0 && (
        <p role="alert" style={errorStyle}>
          {errors.eventAt[0]}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-3)',
        }}
      >
        <div>
          <label
            htmlFor="eventEndsAtDate"
            data-testid="compose-event-ends-at-date-label"
            style={labelStyle}
          >
            End date <span style={{ color: 'var(--colour-text-secondary)' }}>(optional)</span>
          </label>
          <input
            id="eventEndsAtDate"
            name="eventEndsAtDate"
            type="date"
            value={endDate}
            onChange={(e) => patch({ eventEndsAtDate: e.target.value })}
            data-testid="compose-event-ends-at-date"
            className="gps-input"
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label
            htmlFor="eventEndsAtTime"
            data-testid="compose-event-ends-at-time-label"
            style={labelStyle}
          >
            End time <span style={{ color: 'var(--colour-text-secondary)' }}>(optional)</span>
          </label>
          <input
            id="eventEndsAtTime"
            name="eventEndsAtTime"
            type="time"
            value={endTime}
            onChange={(e) => patch({ eventEndsAtTime: e.target.value })}
            data-testid="compose-event-ends-at-time"
            className="gps-input"
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {(rangeError || showServerEndsError) && (
        <p role="alert" data-testid="compose-event-range-error" style={errorStyle}>
          {showServerEndsError && errors.eventEndsAt && errors.eventEndsAt.length > 0
            ? errors.eventEndsAt[0]
            : rangeError}
        </p>
      )}

      <div style={{ marginTop: 'var(--space-3)' }}>
        <label htmlFor="locationText" data-testid="compose-event-location-label" style={labelStyle}>
          Location <span style={{ color: 'var(--colour-text-secondary)' }}>(optional)</span>
        </label>
        <input
          id="locationText"
          name="locationText"
          type="text"
          maxLength={500}
          value={location}
          onChange={(e) => patch({ locationText: e.target.value })}
          placeholder="e.g. Albert Square, Manchester"
          data-testid="compose-event-location"
          className="gps-input"
          style={{ width: '100%' }}
        />
        {errors.locationText && errors.locationText.length > 0 && (
          <p role="alert" style={errorStyle}>
            {errors.locationText[0]}
          </p>
        )}
      </div>
    </fieldset>
  );
}
