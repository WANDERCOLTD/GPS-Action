'use client';

/**
 * @build-unit BU-calendar-near-me
 * @spec architecture/decision-log.md (D076)
 * @spec docs/adrs/0002-post-location-coords.md
 * @spec docs/build/session-briefs/bu-calendar-near-me.md
 *
 * Near-me view — lists in-person event-bearing posts ordered by
 * Haversine distance from the caller's location. Caller location is
 * either: (a) browser geolocation (navigator.geolocation) or
 * (b) a typed UK postcode resolved via postcodes.io.
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
 * resolved coords.
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
import { LocateFixed, MapPin } from 'lucide-react';
import { CalendarRow, type CalendarRowPost } from './CalendarRow';
import type { NearSort } from './view';
import { haversineKm, geocodeUkPostcode, type LatLng } from '@/shared/geo';

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

const emptyWrapStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  color: 'var(--colour-text-secondary)',
  background: 'var(--colour-surface-raised)',
  border: '1px solid var(--colour-border-subtle)',
  borderRadius: 'var(--radius-md)',
};

function renderSortToggle(active: NearSort, onChange: (sort: NearSort) => void): ReactNode {
  return (
    <div data-testid="calendar-near-sort-toggle" style={sortRowStyle}>
      <span style={sortLabelStyle}>Sort:</span>
      <button
        type="button"
        data-testid="calendar-near-sort-distance"
        data-sort="distance"
        aria-pressed={active === 'distance'}
        onClick={() => onChange('distance')}
        className={active === 'distance' ? 'gps-chip gps-chip--active' : 'gps-chip'}
      >
        Distance
      </button>
      <button
        type="button"
        data-testid="calendar-near-sort-date"
        data-sort="date"
        aria-pressed={active === 'date'}
        onClick={() => onChange('date')}
        className={active === 'date' ? 'gps-chip gps-chip--active' : 'gps-chip'}
      >
        Date
      </button>
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

interface PostcodeFormProps {
  onPostcode: (coords: LatLng) => void;
}

/**
 * Stateful inner form. Lives apart from `renderPromptPanel` so the
 * panel can be rendered as a plain element by tests without invoking
 * `useState`. `useState` only fires when this component itself is
 * rendered, which the unit tests skip via type-walking the tree.
 */
function PostcodeForm({ onPostcode }: PostcodeFormProps) {
  const [postcode, setPostcode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (postcode.trim() === '') return;
    setError(null);
    setResolving(true);
    const coords = await geocodeUkPostcode(postcode);
    setResolving(false);
    if (!coords) {
      setError('Could not find that postcode. Check the spelling and try again.');
      return;
    }
    onPostcode(coords);
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
          autoComplete="postal-code"
          placeholder="e.g. M1 4BT"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          style={inputStyle}
          aria-label="UK postcode"
        />
        <button
          type="submit"
          data-testid="calendar-near-postcode-submit"
          disabled={resolving || postcode.trim() === ''}
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
          ? 'We need a location to find nearby events. Try a postcode instead.'
          : 'Allow your location, or type a UK postcode to find in-person events sorted by distance.'}
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
        <PostcodeForm onPostcode={onPostcode} />
      </div>
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
