'use client';

/**
 * @build-unit BU-post-location-input BU-postcode-or-place
 * @spec product/parking-lot.md ("Geocoding pipeline for post locations (Path B)")
 * @spec docs/adrs/0002-post-location-coords.md
 * @spec docs/build/session-briefs/bu-postcode-or-place.md
 *
 * Shared location + isOnline block used by the composer and the
 * /post/[id]/edit form. Renders two inputs:
 *
 *  - **Location** (`<input type="text">`) — accepts a UK postcode OR
 *    a town / city / area name. Resolved via `resolveLocation` at
 *    submit time (postcodes.io for full UK postcodes; Nominatim via
 *    our /api/geocode/place server proxy for free text). UK-biased.
 *  - **This is online** (`<input type="checkbox">`) — when checked,
 *    the location field is disabled and any existing coords get
 *    cleared on save.
 *
 * Resolution runs at submit (caller's responsibility) so the user
 * sees no friction while typing — the resolvers are fast but
 * networked, and we don't want to fire on every keystroke.
 *
 * State is lifted to the parent so values survive kind toggles
 * (mirrors the EventFieldsBlock pattern).
 *
 * The FormData field name `postcode` is preserved verbatim
 * (server-action contract); UI labels its as "UK postcode, town or
 * city" since that's what the field now accepts.
 *
 * Names submitted via FormData:
 *  - postcode (free text or "")
 *  - isOnline ("true" or absent)
 *
 * The parent form action resolves the location and sets
 * `latitude`, `longitude`, `isOnline` accordingly before invoking
 * the create / update server action.
 */

import { type CSSProperties } from 'react';

export interface PostLocationFieldsState {
  postcode: string;
  isOnline: boolean;
}

export const EMPTY_POST_LOCATION_FIELDS_STATE: PostLocationFieldsState = {
  postcode: '',
  isOnline: false,
};

interface PostLocationFieldsBlockProps {
  value: PostLocationFieldsState;
  onChange: (next: PostLocationFieldsState) => void;
  /** Inline error string when geocoding fails. */
  geocodeError?: string | null;
  /** When true, the postcode input is also disabled (e.g. submitting). */
  disabled?: boolean;
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

const helperStyle: CSSProperties = {
  marginTop: 'var(--space-1)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  fontFamily: 'var(--font-ui)',
};

const errorStyle: CSSProperties = {
  color: 'var(--colour-danger)',
  fontSize: 'var(--text-xs)',
  marginTop: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

const attributionStyle: CSSProperties = {
  marginTop: 'var(--space-2)',
  fontSize: 'var(--text-2xs)',
  color: 'var(--colour-text-secondary)',
  fontFamily: 'var(--font-ui)',
};

export function PostLocationFieldsBlock({
  value,
  onChange,
  geocodeError = null,
  disabled = false,
}: PostLocationFieldsBlockProps) {
  function patch(next: Partial<PostLocationFieldsState>): void {
    onChange({ ...value, ...next });
  }

  const postcodeDisabled = disabled || value.isOnline;

  return (
    <fieldset
      data-testid="compose-location-fields"
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
        Where is it?
      </legend>

      <div style={{ marginTop: 'var(--space-2)' }}>
        <label htmlFor="postcode" data-testid="compose-postcode-label" style={labelStyle}>
          UK postcode, town or city{' '}
          <span style={{ color: 'var(--colour-text-secondary)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="postcode"
          name="postcode"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={100}
          placeholder="e.g. M1 4BT, or Manchester"
          value={value.postcode}
          onChange={(e) => patch({ postcode: e.target.value })}
          disabled={postcodeDisabled}
          aria-disabled={postcodeDisabled}
          data-testid="compose-postcode-input"
          className="gps-input"
          style={{
            width: '100%',
            opacity: postcodeDisabled ? 0.6 : 1,
            borderColor: geocodeError ? 'var(--colour-danger)' : undefined,
          }}
        />
        <p style={helperStyle}>We&apos;ll add a pin so people nearby can find this on the map.</p>
        {geocodeError && (
          <p role="alert" data-testid="compose-postcode-error" style={errorStyle}>
            {geocodeError}
          </p>
        )}
        <p data-testid="compose-location-attribution" style={attributionStyle}>
          Locations resolved via OpenStreetMap.
        </p>
      </div>

      <label
        data-testid="compose-is-online-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-ui)',
          color: 'var(--colour-text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          name="isOnline"
          value="true"
          checked={value.isOnline}
          onChange={(e) => patch({ isOnline: e.target.checked })}
          disabled={disabled}
          data-testid="compose-is-online-toggle-input"
        />
        <span>This is online</span>
      </label>
    </fieldset>
  );
}
