---
slug: bu-prod-auth
status: planned
phase: 2
priority: high
note: 'Discussion stub. Pre-Vercel blocker — production deploy needs a real auth path. Not scoped yet; this brief captures the options and decision points to settle before scoping.'
---

# SESSION BRIEF · bu-prod-auth — production authentication

_Brief version: 0.1 (discussion) · Author: Paul (via Claude) · Date: 2026-04-30_

---

## Why this exists / why now

Today's authentication is the dev-auth stub from `BU-001-lite`:

- `/dev/login` shows a list of seeded users, sets `gps_dev_user_id`
  cookie, redirects to `/feed`.
- The whole `/dev/*` path tree is gated by
  `if (process.env.NODE_ENV !== 'production') return notFound()`.
- `createTRPCContext()` reads the cookie and resolves it to a `User`
  row.

In production this is fine — the dev surface 404s, no one can log
in. **Which means no one can use the app.** Production deploy on
Vercel is blocked until there's a real auth flow that works in the
production build.

The walkthroughs the user is preparing happen on local dev, so this
isn't urgent for the BU-feed-card-affordances release. It IS the
blocker for moving the walkthrough cohort onto a deployed Vercel
environment, and so for any "share this URL with a member" demo path.

---

## Objective

Pick a production auth strategy, build the minimum viable surface
that lets a member sign in to the deployed app and have
`createTRPCContext()` return a real `ctx.user`. Existing `RoleGrant`
and `User` tables are reusable as-is — what's missing is the path
from "human in a browser" to "User row resolved into ctx".

Existing tRPC procedures, server actions, and the entire feed /
compose / requests surface are auth-aware via `ctx.user` already, so
the change is contained to the auth boundary itself.

---

## Decisions to settle (before scoping)

### 1. Auth method

| Option | Effort | UX | Notes |
|---|---|---|---|
| **Magic-link email** | Medium | Plain — user enters email, gets a link | Self-hosted (Resend / Postmark / SES) is straightforward; matches the activist-network audience (no social-platform dependency) |
| **OAuth — Google / Apple** | Medium-low | One tap on iPhone | Activist members may distrust a Google sign-in for political work — research call |
| **Email + password** | Medium | Familiar but worst | Forgot-password flows, hashing discipline, brute-force protection. Avoid unless required |
| **Passkeys (WebAuthn)** | High | Best on modern iPhones | Probably overkill for v1; revisit later |
| **Demo-mode bearer** | Trivial | One link per cohort | Interim only — a single shared "demo session" cookie that authenticates as a fixed seeded user. Useful for walkthrough cohorts on prod-Vercel before real auth ships |

**Recommended starting point**: magic-link email + a separate
demo-mode bearer for the walkthrough cohort. Magic-link is the
production answer; demo-mode lets you ship to Vercel before
magic-link is built.

### 2. Account scope at signup

- Anyone with an email can sign in?
- Or invite-only — admin pre-seeds the User row with email, magic-link
  is the activation step, no self-signup?

For an activist network, **invite-only** is the safer default. The
network curates membership; the auth surface just verifies.

### 3. Onboarding / display name

Today's User has `displayName` set via seed. With invite-only, the
admin sets it at invite time. With self-signup, a "what should we
call you?" step at first login is needed.

### 4. Session length

- Long (~30 days) with refresh
- Medium (~7 days), no refresh — re-auth weekly
- Short (~24h) — paranoid

Most members log in on phones they own. **30 days, refresh on
activity** is industry default.

### 5. Logout / device list

MVP: one logout button, kills the session. Phase 2: list active
sessions ("you're logged in on iPhone 14, Mac Safari").

---

## Scope (when ready to build)

This brief is a **stub**. When the decisions above are settled, the
scope likely becomes:

**In scope:**
- Auth provider choice + integration (e.g. magic-link via Resend)
- A new `/login` page (pretty version of `/dev/login`)
- A new server action `requestLoginLink({ email })` and a callback
  route `/auth/callback?token=…`
- Session storage (signed-cookie or DB-backed sessions table)
- `createTRPCContext()` updated to read the new session cookie in
  production AND fall back to the dev cookie in development
- A "Demo mode" bearer fallback if we go that route — a `?demo=…`
  query param on first visit that sets a cookie for a seeded user

**Out of scope** (separate BUs):
- Password / passkey support
- Account-management surface (change email, list sessions, delete
  account) — minimum is logout
- Email verification (the magic-link IS the verification)

---

## Definition of done

- A new browser hitting the deployed prod URL can sign in via a
  flow that doesn't depend on `/dev/*`
- `ctx.user` resolves correctly under that session
- Existing tests still pass; new tests cover the auth callback +
  session validation
- The seeded demo users are still accessible in dev (no regression)
- A new ADR (`D075` likely) records the chosen method and rationale

---

## Related

- `BU-001-lite` — the dev-auth stub this BU eventually replaces /
  augments
- D003 — the original auth ADR
- `bu-vercel-prep` — the deploy-checklist BU; this brief is its
  hardest unblock
