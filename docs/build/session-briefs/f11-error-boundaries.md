---
slug: f11-error-boundaries
status: shipped
shipped_in: "#63"
phase: 0
---
# SESSION BRIEF · F11 — Error boundaries in the UI shell

_Brief version: 1.0 · Author: Paul · Date: April 2026_
_Priority: Phase 0 chore. Ships in the same PR as F12 (BU-healthcheck) under
the umbrella "shell safety foundations" — both are tiny and conceptually
adjacent (one component crash should not take the whole app down; readiness
should be observable)._

---

## Objective

Ship a typed, reusable `<ErrorBoundary>` component and wire it into the root
layout so a single component crash does not take the whole app down. The
boundary tags errors with a `name` for downstream observability (D037 — Sentry
when it lands) and renders a caller-supplied fallback. Success: throwing in a
descendant of the root boundary renders the fallback while the rest of the
shell (`<html>`, `<body>`, providers if any) remains live.

This brief is one half of the **shell foundations** PR. The other half is F12
(`BU-healthcheck`). They are bundled because each is tiny on its own and they
share the "the runtime shell is observable and resilient" theme.

---

## Scope

### Build in this session

- `components/ErrorBoundary.tsx` (new — class component; named export)
- `app/layout.tsx` (modify — wrap children in `<ErrorBoundary>`)
- `tests/unit/error-boundary.test.tsx` (new — Vitest unit tests)
- `docs/build/phase-0-foundations.md` (modify — flip F11 row to ✅)

### Do NOT touch

- `prisma/schema.prisma` — no schema work
- Any `server/**` file — boundary is client-only UI shell
- Other `components/**.tsx` files — out of scope; per-feature boundaries
  land in feature briefs as those features ship
- The root layout's existing `<LoggedInAs />` usage and tRPC context wiring —
  preserve exactly; the boundary wraps `children` not the whole tree
- `eslint.config.js` — no new rule, no new globs needed
- `package.json` — no new dependencies (see "Sentry handling")

### Out of scope for this session

- **Sentry integration.** `@sentry/nextjs` is not installed yet. The
  reporting seam exists (a private `reportError` method that logs structured
  fields via `console.error`) and carries a `TODO`-shaped comment naming the
  hook for D037. When Sentry lands, this is a one-line swap. Do **not** add
  the dependency in this PR.
- **Per-feature error boundaries.** F11 ships the primitive + the root
  wrap. Wrapping individual feature roots (`<ErrorBoundary name="feed">`,
  etc.) is the responsibility of each feature BU as it lands.
- **A "try again" recovery button.** Adding interactive recovery would
  require a `data-testid` per F14 and a state-reset story. Left to a future
  brief — the v1 fallback is intentionally text-only.
- **Server-component error handling.** Next.js App Router has its own
  `error.tsx` convention for route-level server errors. That mechanism is
  complementary; F11 doesn't replace it. A future brief can add `error.tsx`
  files at route boundaries if/when needed.
- **Suspense boundaries.** Loading-state primitive — different concern,
  separate brief.
- **PostHog / Better Stack hooks.** Same answer as Sentry — D037 stack lands
  later; the seam is ready.

---

## Contracts

### Inputs consumed

- React 19 (already a project dependency)
- Next.js 15 App Router root layout convention
- `styles/tokens.css` — for any colour token in the fallback (lenient F15
  rule applies; no hardcoded hex)

### Outputs produced

These become commitments other code can rely on:

- **`<ErrorBoundary name fallback>{children}</ErrorBoundary>`** — class
  component, named export from `components/ErrorBoundary.tsx`. Catches errors
  thrown during render of any descendant; renders `fallback` until remounted.
- **Default fallback rendered in `app/layout.tsx`** — text-only, honest copy,
  no interactive elements, design-token-styled.
- **`reportError(error, info)` private hook** — logs a structured JSON line
  with `boundary`, `error.name`, `error.message`, `componentStack`. Replace
  with `Sentry.captureException` when D037 lands.

---

## The component shape — spec

```tsx
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  name: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.reportError(error, info);
  }

  private reportError(error: Error, info: ErrorInfo): void {
    // TODO(D037): swap to Sentry.captureException once @sentry/nextjs
    // is installed. Structured console for now so logs can be parsed
    // by Better Stack the moment shipping lands.
    console.error(
      JSON.stringify({
        event_type: 'ui_error_boundary_caught',
        boundary: this.props.name,
        error_name: error.name,
        error_message: error.message,
        component_stack: info.componentStack,
      }),
    );
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

Notes:

- Strict-mode safe — no `any`, no `@ts-ignore`.
- `'use client'` directive — required for class components / lifecycle in
  the App Router.
- `reportError` is private and synchronous to keep the seam simple. When
  Sentry lands, the call signature swaps; the public API doesn't.
- The fallback is provided by the caller — the boundary itself imposes no
  copy. `app/layout.tsx` provides a sensible top-level default.

---

## Root-layout wiring

`app/layout.tsx` currently:

```tsx
<html lang="en" data-theme="light">
  <body>
    <LoggedInAs user={ctx.user} />
    {children}
  </body>
</html>
```

After F11:

```tsx
<html lang="en" data-theme="light">
  <body>
    <LoggedInAs user={ctx.user} />
    <ErrorBoundary name="root" fallback={<RootErrorFallback />}>
      {children}
    </ErrorBoundary>
  </body>
</html>
```

`<LoggedInAs />` deliberately sits **outside** the boundary so the dev-user
header still renders when something downstream crashes. This is a defensible
small-team choice: when the boundary fires in dev, you can still see who
you're logged in as and click "Switch user" to recover.

The `<RootErrorFallback />` is a tiny server component (no client JS, no
interactivity) co-located in `app/layout.tsx` (or extracted into the same
file). It uses design tokens — no hardcoded colours, no inline interactive
elements. F14 (`require-testid`) does not fire on text-only static markup.

Honest copy (per design-philosophy.md):

> Something went wrong loading the page. Try refreshing — if it keeps
> happening, this has been logged.

No "Oops!". No fake reassurance. No "we've notified our team" until the
notification pipeline is real.

---

## Acceptance criteria

### Functional

- [ ] `components/ErrorBoundary.tsx` exists, exports `ErrorBoundary`
- [ ] Class component with `getDerivedStateFromError` + `componentDidCatch`
- [ ] Props: `name: string`, `fallback: ReactNode`, `children: ReactNode`
- [ ] Strict-mode types — no `any`, no `@ts-ignore`
- [ ] `app/layout.tsx` wraps `children` in `<ErrorBoundary name="root">`
- [ ] `<LoggedInAs />` remains outside the boundary
- [ ] Top-level fallback uses design tokens; no interactive elements
- [ ] Honest copy in fallback (no manufactured reassurance)

### Mechanical

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npx prettier --check .` clean
- [ ] `npm test` — all passing including new tests
- [ ] `npm run trace:check` clean

### Tests

`tests/unit/error-boundary.test.tsx` covers:

- Renders children when nothing throws
- Catches an error thrown during render and renders the fallback
- Calls a reporter (spy on `console.error`) when an error is caught
- Reporter payload includes `boundary` (== name prop), `error_name`,
  `error_message`, `component_stack`

The test runs in jsdom (added per-file via the Vitest `// @vitest-environment
jsdom` pragma; the project's default test environment is `node`). The
component is exercised via `react-dom/server`'s `renderToString` — no React
Testing Library is currently configured, and adding it sits outside this
brief. `renderToString` is sufficient to verify children render in the happy
path. For the catch path, the test instantiates the class directly and
invokes `getDerivedStateFromError` + `componentDidCatch` against a contrived
`ErrorInfo`. This avoids dragging RTL in for one component.

### Manual / smoke

- [ ] `npm run dev`, throw in a child component below the root boundary,
      confirm the fallback renders and the rest of the shell (`<LoggedInAs />`)
      stays live. **If the dev server can't be run in this session, document
      the manual steps in the PR body.**

---

## Permission matrix

N/A — pure UI shell. No role-gated behaviour.

---

## UI states

| State          | Trigger                                            | What user sees                                                 | What user can do                |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| Healthy        | Default                                            | The app, normally                                              | Everything                      |
| Caught error   | Descendant throws during render                    | Top-level fallback message + dev header (`<LoggedInAs />`)     | Refresh; navigate via URL       |
| Reset on route | New `children` mount (Next router navigation)      | Fresh tree; if no throw this time, healthy                     | Everything                      |

There is no in-component "try again" button in v1 — the recovery vector is
"refresh" or "navigate elsewhere". Adding interactive recovery is its own
brief (see Out of scope).

---

## Tests required

See "Tests" under Acceptance criteria above. Single test file:
`tests/unit/error-boundary.test.tsx`.

Not required:

- React Testing Library setup (out of scope; adds a dev dep — separate
  decision)
- E2E click-through (manual smoke covers it)
- Visual regression on the fallback (no screenshot infra yet)

---

## Scenarios to verify against

F11 doesn't map to a product scenario directly — it's shell infrastructure.
Verification is the test suite + the manual smoke described above.

---

## Known gotchas

- **Server vs client.** The boundary itself is `'use client'` because class
  lifecycle methods only run on the client. That's fine — it sits inside
  `app/layout.tsx` (a server component) and accepts a client-rendered
  `children` subtree. Next.js handles the boundary marker.
- **Server-thrown errors.** This boundary catches **render-time** errors in
  client components. Server-component errors propagate to Next.js's
  `error.tsx` convention (not built here). Don't expect F11 to catch a
  server-side `await` rejection — it won't, by design.
- **`<LoggedInAs />` placement.** Deliberately above the boundary so the
  dev header survives a crash. If we ever ship a production-facing top-bar
  that *should* break together with the rest of the app, restructure then;
  not now.
- **Hydration mismatches.** The boundary catches render errors but not
  hydration mismatches in older React versions. React 19's improved
  hydration error reporting plus the boundary together is sufficient for
  MVP.
- **F14 (`require-testid`).** Fires on interactive DOM. The fallback is
  text-only — no `<button>` / `<a>` / handlers — so the rule does not
  fire. If a future change adds a "Refresh" button, the rule will demand a
  testid. Add it then.
- **F15 (`require-design-tokens`).** Fires on hardcoded hex / `rgb()` /
  `hsl()`. Use `var(--colour-...)` for any colour in the fallback. Easy.
- **`trace:check`.** The header carries `@spec docs/build/phase-0-foundations.md
  §F11` — a spec path with no parenthetical ref, so it does not trigger
  the unknown-SCN/D-NN check. Good.
- **JSON `console.error`.** Structured payloads are easier to parse later
  (Better Stack ingests JSON). Plain string would work too; JSON is the
  small forward-leaning choice.

---

## Definition of done

- [ ] All files in "Build in this session" created or updated
- [ ] No file in "Do NOT touch" modified
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` passes (including new tests)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean
- [ ] F11 row in `docs/build/phase-0-foundations.md` flipped to ✅ with
      this PR linked
- [ ] Commit message: `feat(shell): BU-error-boundary — root + feature
      error boundaries (F11)`
- [ ] Branch pushed; PR opened against `main` (joint with F12)

---

## Open questions to surface

1. **Sentry seam name.** The reporter currently logs `event_type:
   'ui_error_boundary_caught'`. When PostHog lands (D037), that event will
   want a canonical name from `analytics-events.md`. Confirm naming when
   Sentry / PostHog land — for now, the literal is internal.
2. **Multiple boundaries per route.** The brief wraps the root once.
   Future feature briefs (BU-feed, BU-comments) should add a per-feature
   boundary inside their root component. That's their responsibility, not
   this brief's. Confirm.
3. **A "Refresh" button.** Currently text-only fallback (no `data-testid`
   needed; F14 doesn't fire). If we ever add a refresh button, that's an
   interactive element — needs a testid (`auth-error-refresh` or similar
   from a canonical area). Defer until a real need surfaces.

(Claude Code: surface any further judgement calls during implementation.)

---

## Context

**Specs:**

- `docs/build/phase-0-foundations.md` §F11
- `docs/architecture/decision-log.md` D037 (observability stack)
- `docs/process/working-rhythm.md` (the three rules)
- `docs/product/design-philosophy.md` (honest copy, no manufactured
  reassurance)

**Existing code to read first:**

- `app/layout.tsx` — current root-layout shape
- `components/auth/LoggedInAs.tsx` — co-existing top-level component;
  the boundary sits below it
- `eslint-rules/rules/require-build-unit-header.js` — the header rule
- `eslint-rules/rules/require-spec-tag.js` — the spec-tag rule
- `eslint-rules/rules/require-testid.js` — confirms text-only fallback
  is rule-safe
- `eslint-rules/rules/require-design-tokens.js` — confirms `var(--...)`
  usage is rule-safe

**Process:**

- `docs/process/session-brief-template.md`
- `CLAUDE.md`

---

## What this brief does NOT cover

1. **Per-feature boundaries** — feature BUs add their own
2. **Sentry / PostHog / Better Stack integration** — D037 lands later
3. **`error.tsx` route-level handlers** — separate brief if needed
4. **Suspense / loading boundaries** — separate concern
5. **Recovery UX** — text-only fallback in v1; interactive recovery is a
   future brief

---

## Slice convention

F11 is a Phase 0 chore. Pairs with F12 in a single PR titled "shell
foundations". Each file carries its own `@build-unit` (F11 files →
`BU-error-boundary`; F12 files → `BU-healthcheck`). The PR description
names both.
