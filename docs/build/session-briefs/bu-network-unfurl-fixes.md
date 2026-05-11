---
slug: bu-network-unfurl-fixes
status: in-flight
phase: 2
---
# SESSION BRIEF · bu-network-unfurl-fixes — favicon fallback + X compact treatment

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-05-11_
_Priority: NetworkCard polish. Follow-up to BU-network-feed +
BU-link-share. Filed in-conversation, lowercase prefix = descriptive
reference (brief-status gate skips per D068)._

---

## Objective

Two visible bugs on `/network`:

1. **X / Twitter cards blow up the user's avatar to full width.** Our
   OG fetcher returns whatever `og:image` / `twitter:image` Twitter
   exposes to anonymous scrapers — which for profile/post URLs is a
   ~400×400 avatar. `LinkPreviewCard` then renders it at 16:9 cover,
   so the avatar dominates the card.
2. **Pages with no `og:image` render a solid grey 16:9 block** instead
   of a useful fallback. Example: the CUFI events page card.

Out-of-scope (separate problems, blocked on other parties):

- **URL extraction from inside message text** — Grant's Supabase view
  decides which messages even reach us with a populated `url`. To talk
  to him.
- **Relative-URL resolution for `og:image`** — already in place at
  `server/services/link-metadata.ts:181-198` via `resolveUrl`.

---

## Scope

### Build in this session

**Favicon extraction (`server/services/link-metadata.ts`):**
- Add `faviconUrl: string | null` to `LinkMetadata`.
- Parse `<link rel="icon" | "shortcut icon" | "apple-touch-icon">`
  out of `<head>`, prefer larger `sizes`. Fall back to
  `${origin}/favicon.ico` if no link tag found.
- Resolve relative URLs via existing `resolveUrl` helper.

**Wire propagation:**
- `NetworkCardLinkPreview` (`shared/network-card.ts`) gains
  `faviconUrl: string | null`.
- `server/services/network.ts` passes it through the default
  resolver.

**LinkPreviewCard favicon fallback (`components/LinkPreviewCard.tsx`):**
- New optional prop `linkFaviconUrl?: string | null`.
- When `linkImageUrl` is null: **collapse the image block entirely**
  (no grey hero). Render the favicon inline in the site row (16×16,
  to the left of the site name).
- When `linkImageUrl` is set: render the hero as today (favicon
  unused).

**NetworkCard X / Twitter compact treatment (`components/NetworkCard.tsx`):**
- Detect host = `x.com` | `twitter.com` (incl. `www.` prefix) via a
  small inline helper.
- For those hosts, pass `size="small"` to `LinkPreviewCard` (96×96
  square image + body to the right). Reuses existing size variant —
  no new variant introduced.
- Pass `linkFaviconUrl={card.linkPreview?.faviconUrl}` through.

### NOT in this session

- Talking to Grant about URL extraction (Paul, separately).
- New "twitter" size variant — `small` reused.
- Scraping page `<img>` tags as last-resort hero (high junk rate).
- HEAD-check on `og:image` URLs to detect 404s.
- Multi-URL extraction.

---

## Tests to add / update

- `tests/unit/link-metadata.test.ts` (NEW) — favicon extraction
  cases: rel="icon", rel="shortcut icon", rel="apple-touch-icon",
  no link tag → `/favicon.ico` fallback, relative URL resolution.
- `tests/unit/link-preview-card.test.tsx` — favicon-fallback path:
  no hero rendered when `linkImageUrl=null` and `linkFaviconUrl`
  set; favicon `<img>` appears in site row.
- `tests/unit/network-card.test.tsx` — X/Twitter URL passes
  `size="small"` to `LinkPreviewCard`; non-X URL passes `large`;
  faviconUrl plumbed through.
- Existing fixtures with `linkPreview: { ... }` must add
  `faviconUrl: null` to satisfy the new shape.

---

## Done when

1. Favicon extracted and surfaced on the wire under
   `linkPreview.faviconUrl`.
2. CUFI-style page (no og:image) renders text-only card with favicon
   in the site row, no grey block.
3. X / Twitter URLs render with a 96×96 thumbnail instead of a full-
   width avatar.
4. `pnpm typecheck && pnpm lint && pnpm test` clean.
5. `package.json` version bumped (PATCH).
