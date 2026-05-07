# RelativeTime

Hydration-safe relative timestamp ("2 minutes ago", "yesterday",
"3 days ago"). Wraps `<ClientOnly>` so the server render and first
client paint show a stable absolute fallback (the ISO date by
default), then swap to `formatDistanceToNow(...)` after mount.

## Why

`formatDistanceToNow` reads `Date.now()` every time it runs. The
server runs it at request time; the client runs it again at
hydration time. Across an "X-ago" bucket boundary (e.g. a post
crosses the 1-minute → 2-minute boundary between SSR and hydration)
the two strings diverge and React throws a hydration warning.

The fix is timing-of-computation, not the format. We keep the
relative form (it's the affordance members orient on in a feed)
and just defer it past hydration.

## Contract

```tsx
<RelativeTime date={post.createdAt} className="gps-meta" />

// With a custom fallback (rare — the ISO default is usually fine):
<RelativeTime date={comment.createdAt} fallback="just now" />
```

- `date`: ISO 8601 string or `Date`. Component normalises.
- `fallback`: optional override for the SSR / first-paint string.
  Default is the ISO date (deterministic, accessible).
- `className`, `style`: passed through to the rendered `<time>`.
- The rendered element is always `<time dateTime={iso}>`. The
  `dateTime` attribute carries the canonical ISO timestamp on
  every render path so screen readers and indexers have a stable
  handle regardless of which branch is showing.

## Build units

- **BU-hydration-fixes** (2026-05-07) — first introduced. See D080.

## Related

- `components/ClientOnly` — the SSR/CSR-gating primitive this
  wraps. New code rendering "X ago" should use `<RelativeTime>`,
  not inline `formatDistanceToNow`.
- D080 — architectural note on the deferred-render pattern.
