/**
 * @build-unit BU-search-surface
 * @spec product/analytics-events.md
 * @spec architecture/decision-log.md (D078)
 *
 * Client-side telemetry helper for the 4 BU-search-surface events.
 * Posts to the `/api/analytics/search` stub sink (mirrors the
 * `share-intent` pattern from BU-whatsapp-share — replaced by the
 * real PostHog client when BU-share-out lands).
 *
 * Privacy (D078 + analytics-events.md PII policy): NEVER include the
 * raw query string in any payload. Only enums, integers, and bools.
 * Member names commonly appear in queries — leaking them to analytics
 * is the failure mode this rule exists to prevent.
 */

export type SearchTelemetryEvent =
  | { event: 'search_opened'; source: 'appnav' | 'deep_link' | 'scope_chip' }
  | { event: 'search_query_submitted'; q_length: number; has_scope_chip: boolean }
  | {
      event: 'search_result_clicked';
      entity_type: 'posts' | 'people' | 'regions' | 'partnerOrgs';
      position_in_group: number;
      group_position: number;
    }
  | {
      event: 'search_see_all_clicked';
      entity_type: 'posts' | 'people' | 'regions' | 'partnerOrgs';
    };

export function emitSearchEvent(event: SearchTelemetryEvent): void {
  if (typeof window === 'undefined') return;
  // Fire-and-forget per analytics-events.md rule 2 — never block a user
  // action on analytics. `keepalive` lets the request survive page
  // unmount when the click is also a navigation.
  try {
    void fetch('/api/analytics/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Network/runtime failures are silent. Analytics MUST NOT surface
    // to the member.
  }
}
