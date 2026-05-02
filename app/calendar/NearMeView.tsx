'use client';

/**
 * @build-unit BU-calendar-near-me BU-icon-strips BU-postcode-or-place
 * @spec architecture/decision-log.md (D076)
 * @spec docs/adrs/0002-post-location-coords.md
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 * @spec docs/build/session-briefs/bu-icon-strips.md
 * @spec docs/build/session-briefs/bu-postcode-or-place.md
 * @spec docs/product/design-philosophy.md (Glyph register)
 *
 * Near-me view — lists in-person event-bearing posts ordered by
 * Haversine distance from the caller's location. Caller location is
 * either: (a) browser geolocation (navigator.geolocation) or
 * (b) a typed UK postcode OR town/city/area, resolved via the
 * chained `resolveLocation` helper (postcodes.io for postcode shape,
 * Nominatim via our /api/geocode/place server proxy for free text).
 *
 * State machine:
 *
 *   - 'prompt'           — initial; user hasn't picked a method yet.
 *   - 'locating'         — geolocation in progress.
 *   - 'permission_denied'— geolocation rejected; postcode still works.
 *   - 'located'          — { lat, lng } resolved; list renders.
 *
 * Sort toggle (Date / Distance) is URL-driven via `?sort=` so the back
 * button restores it. Default is `distance` ascending. Sort + located
 * coords are independent — flipping sort doesn't invalidate the
 * resolved coords. Per BU-icon-strips, the sort buttons render
 * lucide icons (Distance = `RulerDimensionLine`, the map-scale-bar
 * glyph; Date = `Calendar`, re-using PostCard's "Event time" entry
 * per Rule 2 of the glyph register) and are wrapped in
 * `IconChipTooltip` for the human-readable label.
 *
 * Data flow: the page passes the entire candidate list (in-person
 * events, eventAt set, sorted by date by default). When coords land,
 * we re-sort by distance using `haversineKm` from `shared/geo.ts`.
 *
 * Architecture note: stateless `NearMeViewBody` does the rendering
 * given a state object so the test pattern is plain-call testable
 * (mirrors AgendaView / MonthViewBody).
 */

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Calendar, LocateFixed, MapPin, RulerDimensionLine } from 'lucide-react';
import { IconChipTooltip } from '@/components/IconChipTooltip';
import { CalendarRow, type CalendarRowPost } from './CalendarRow';
import type { NearSort } from './view';
import { haversineKm, resolveLocation, MIN_PLACE_QUERY_LENGTH, type LatLng } from '@/shared/geo';

export interface NearMeCandidate extends CalendarRowPost {
  /** Required for distance sort. The page filters out NULL-coord posts upstream. */
  latitude: number;
  longitude: number;
}

interface NearMeViewProps {
  posts: NearMeCandidate[];
  /** Initial sort, parsed from `?sort=` on the server. */
  initialSort: NearSort;
}

type LocationState =
  | { kind: 'prompt' }
  | { kind: 'locating' }
  | { kind: 'permission_denied' }
  | { kind: 'located'; coords: LatLng };

const sectionStyle: CSSProperties = {
  marginTop: 'var(--space-4)',
};

const promptStyle: CSSProperties = {
  padding: 'var(--space-5) var(--space-4)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 'var(--space-4)',
};

const promptHeaderStyle: CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-3)',
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--weight-semibold)',
};

const promptCopyStyle: CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-4)',
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-text-secondary)',
  lineHeight: 'var(--line-snug)',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--colour-border-subtle)',
  background: 'var(--colour-surface)',
  color: 'var(--colour-text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--colour-border-subtle)',
  background: 'var(--colour-surface)',
  color: 'var(--colour-text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  width: 140,
};

const sortRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  marginBottom: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  alignItems: 'center',
};

const sortLabelStyle: CSSProperties = {
  color: 'var(--colour-text-secondary)',
  marginRight: 'var(--space-2)',
};

const distancePillStyle: CSSProperties = {
  display: 'inline-block',
  marginRight: 'var(--space-2)',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  fontSize: 'var(--text-2xs)',
  fontWeight: 600,
  color: 'var(--colour-text-secondary)',
  fontFamily: 'var(--font-ui)',
};

const rowWrapStyle: CSSProperties = {
  position: 'relative',
};

const rowDistanceStyle: CSSProperties = {
  position: 'absolute',
  top: 'var(--space-3)',
  right: 'var(--space-4)',
  zIndex: 1,
};

const errorStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-error, var(--colour-text-secondary))',
  margin: 0,
  marginTop: 'var(--space-2)',
};

const attributionStyle: CSSProperties = {
  fontSize: 'var(--text-2xs)',
  color: 'var(--colour-text-secondary)',
  margin: 0,
  marginTop: 'var(--space-3)',
};

const emptyWrapStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  color: 'var(--colour-text-secondary)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const SORT_ICON_SIZE = 16;
const SORT_ICON_STROKE = 2;

function renderSortToggle(active: NearSort, onChange: (sort: NearSort) => void): ReactNode {
  return (
    <div data-testid="calendar-near-sort-toggle" style={sortRowStyle}>
      <span style={sortLabelStyle}>Sort:</span>
      <IconChipTooltip label="Sort by distance">
        <button
          type="button"
          data-testid="calendar-near-sort-distance"
          data-sort="distance"
          aria-pressed={active === 'distance'}
          aria-label="Sort by distance"
          onClick={() => onChange('distance')}
          className={active === 'distance' ? 'gps-chip gps-chip--active' : 'gps-chip'}
        >
          <RulerDimensionLine
            size={SORT_ICON_SIZE}
            strokeWidth={SORT_ICON_STROKE}
            aria-hidden="true"
          />
        </button>
      </IconChipTooltip>
      <IconChipTooltip label="Sort by date">
        <button
          type="button"
          data-testid="calendar-near-sort-date"
          data-sort="date"
          aria-pressed={active === 'date'}
          aria-label="Sort by date"
          onClick={() => onChange('date')}
          className={active === 'date' ? 'gps-chip gps-chip--active' : 'gps-chip'}
        >
          <Calendar size={SORT_ICON_SIZE} strokeWidth={SORT_ICON_STROKE} aria-hidden="true" />
        </button>
      </IconChipTooltip>
    </div>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

interface DecoratedPost {
  post: NearMeCandidate;
  distanceKm: number | null;
}

/**
 * Pure helper: decorate each candidate with its distance from
 * `located` (when set), then order by `sort`. Distance-sort with no
 * coords yet falls back to date-sort because distance is `null`.
 */
export function sortNearMePosts(
  posts: NearMeCandidate[],
  located: LatLng | null,
  sort: NearSort,
): DecoratedPost[] {
  const decorated: DecoratedPost[] = posts.map((p) => ({
    post: p,
    distanceKm: located ? haversineKm(located, { lat: p.latitude, lng: p.longitude }) : null,
  }));
  if (sort === 'distance' && located) {
    decorated.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else {
    decorated.sort(
      (a, b) => new Date(a.post.eventAt).getTime() - new Date(b.post.eventAt).getTime(),
    );
  }
  return decorated;
}

interface LocationFormProps {
  onLocation: (coords: LatLng) => void;
}

/**
 * Stateful inner form. Lives apart from `renderPromptPanel` so the
 * panel can be rendered as a plain element by tests without invoking
 * `useState`. `useState` only fires when this component itself is
 * rendered, which the unit tests skip via type-walking the tree.
 *
 * BU-postcode-or-place: accepts a UK postcode OR a town / city / area
 * via one field. The submit button stays inert below the
 * `MIN_PLACE_QUERY_LENGTH` threshold (3 chars per locked decision Q6).
 *
 * Existing `data-testid` values keep the `…postcode…` segment
 * verbatim (F14 stability rule); only the visible UX is upgraded.
 */
function LocationForm({ onLocation }: LocationFormProps) {
  const [query, setQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_PLACE_QUERY_LENGTH;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (tooShort) return;
    setError(null);
    setResolving(true);
    const coords = await resolveLocation(query);
    setResolving(false);
    if (!coords) {
      setError("Couldn't find that location. Try a UK postcode, town or city.");
      return;
    }
    onLocation(coords);
  }

  return (
    <>
      <form
        data-testid="calendar-near-postcode-form"
        onSubmit={handleSubmit}
        style={buttonRowStyle}
      >
        <input
          data-testid="calendar-near-postcode-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="UK postcode, town or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
          aria-label="UK postcode, town or city"
        />
        <button
          type="submit"
          data-testid="calendar-near-postcode-submit"
          disabled={resolving || tooShort}
          style={buttonStyle}
        >
          Find
        </button>
      </form>
      {error !== null && (
        <p data-testid="calendar-near-postcode-error" style={errorStyle}>
          {error}
        </p>
      )}
    </>
  );
}

function renderPromptPanel(
  onUseGeolocation: () => void,
  onPostcode: (coords: LatLng) => void,
  permissionDenied: boolean,
  busy: boolean,
): ReactNode {
  return (
    <div data-testid="calendar-near-prompt" style={promptStyle}>
      <h2 style={promptHeaderStyle}>Find events near you</h2>
      <p style={promptCopyStyle}>
        {permissionDenied
          ? 'We need a location to find nearby events. Try a UK postcode, town or city instead.'
          : 'Allow your location, or type a UK postcode, town or city to find in-person events sorted by distance.'}
      </p>
      <div style={buttonRowStyle}>
        {!permissionDenied && (
          <button
            type="button"
            data-testid="calendar-near-use-geolocation"
            onClick={onUseGeolocation}
            disabled={busy}
            style={buttonStyle}
          >
            <LocateFixed size={14} aria-hidden="true" />
            <span>Use my location</span>
          </button>
        )}
        <LocationForm onLocation={onPostcode} />
      </div>
      <p data-testid="calendar-near-attribution" style={attributionStyle}>
        Locations resolved via OpenStreetMap.
      </p>
    </div>
  );
}

interface NearMeViewBodyProps {
  posts: NearMeCandidate[];
  state: LocationState;
  sort: NearSort;
  onUseGeolocation: () => void;
  onPostcode: (coords: LatLng) => void;
  onChangeSort: (sort: NearSort) => void;
}

export function NearMeViewBody({
  posts,
  state,
  sort,
  onUseGeolocation,
  onPostcode,
  onChangeSort,
}: NearMeViewBodyProps) {
  const located = state.kind === 'located' ? state.coords : null;
  const sorted = sortNearMePosts(posts, located, sort);

  return (
    <section data-testid="calendar-near-section" style={sectionStyle}>
      {state.kind !== 'located' &&
        renderPromptPanel(
          onUseGeolocation,
          onPostcode,
          state.kind === 'permission_denied',
          state.kind === 'locating',
        )}

      {state.kind === 'located' && (
        <>
          {renderSortToggle(sort, onChangeSort)}
          {sorted.length === 0 ? (
            <div data-testid="calendar-near-empty" style={emptyWrapStyle}>
              <p style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
                No in-person events near you.
              </p>
              <Link
                href="/compose"
                data-testid="calendar-near-empty-compose"
                style={{ color: 'var(--colour-text-link)', fontSize: 'var(--text-sm)' }}
              >
                Compose an event →
              </Link>
            </div>
          ) : (
            <ul
              data-testid="calendar-near-list"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {sorted.map(({ post, distanceKm }) => (
                <li key={post.id} style={rowWrapStyle}>
                  {distanceKm !== null && (
                    <span
                      data-testid="calendar-near-row-distance"
                      data-distance-km={distanceKm.toFixed(2)}
                      style={{ ...distancePillStyle, ...rowDistanceStyle }}
                    >
                      <MapPin size={10} aria-hidden="true" /> {formatDistance(distanceKm)}
                    </span>
                  )}
                  <CalendarRow post={post} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function NearMeView({ posts, initialSort }: NearMeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = React.useState<LocationState>({ kind: 'prompt' });

  const setSort = React.useCallback(
    (sort: NearSort) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', 'near');
      if (sort === 'distance') params.delete('sort');
      else params.set('sort', sort);
      const qs = params.toString();
      router.replace(qs === '' ? '/calendar' : `/calendar?${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  function handleUseGeolocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ kind: 'permission_denied' });
      return;
    }
    setState({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          kind: 'located',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      () => setState({ kind: 'permission_denied' }),
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  function handlePostcode(coords: LatLng): void {
    setState({ kind: 'located', coords });
  }

  return (
    <NearMeViewBody
      posts={posts}
      state={state}
      sort={initialSort}
      onUseGeolocation={handleUseGeolocation}
      onPostcode={handlePostcode}
      onChangeSort={setSort}
    />
  );
}
