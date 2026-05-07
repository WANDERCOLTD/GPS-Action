# ClientOnly

Tiny `useEffect`-gated wrapper that renders a stable `fallback` on the
server (and on first client paint) then swaps to `children` after mount.

## Why

Some values are inherently impossible to render identically on server
and client: anything depending on `window.location.*`, anything that
reads `Date.now()` at render time (e.g. `formatDistanceToNow`), or
anything reading `localStorage` / browser feature flags. Rendering
those inline produces SSR/CSR hydration mismatches.

`ClientOnly` keeps the server-rendered HTML deterministic — every
request emits the same `fallback` — then transitions to the live
`children` once hydration is finished. The first painted bytes match
the server output; hydration succeeds; the live value flicks in on
the next tick.

## Contract

```tsx
<ClientOnly fallback={<span>—</span>}>
  <span>{window.location.host}</span>
</ClientOnly>
```

- `fallback`: ReactNode rendered on the server and on first client
  paint. Must be deterministic (no side-effects, no `Date.now()`).
- `children`: ReactNode rendered only after `useEffect` fires.
- No props beyond those two. No deps.

## When to reach for this vs `dynamic({ ssr: false })`

|                              | `<ClientOnly>` | `dynamic({ ssr: false })` |
| ---------------------------- | -------------- | ------------------------- |
| Adds an extra JS chunk       | No             | Yes                       |
| Loader boundary / fallback   | Same render    | Suspense-style            |
| Inline use in JSX            | Yes            | Awkward                   |
| Right tool for tiny snippets | Yes            | No                        |

Use `ClientOnly` for inline cases (a timestamp, an `href`). Reach for
`dynamic` only when the deferred subtree is heavy enough that pulling
it out of the SSR bundle is its own win.

## Build units

- **BU-hydration-fixes** (2026-05-07) — first introduced. See D080.

## Related

- `components/RelativeTime` — first consumer; renders the SSR-safe
  ISO timestamp inside `<time>`, then swaps to "X ago" after mount.
- `components/WhatsAppShareButton` — uses an in-component
  `useEffect` (not the wrapper) for the same reason: defers
  origin-aware URL until after mount. The two patterns coexist —
  `ClientOnly` is for "swap one node for another", in-component
  state is for "enrich one rendered prop".
- D080 — the architectural ADR for this pattern.
