# SESSION BRIEF · BU-link-share — Link-share preview cards + clipboard detection + OG scraper

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-26_

Pairs with **D060** (Post schema additions) and **D061** (Global tap
interaction pattern). Read those ADRs first — every decision below is
downstream of them.

---

## Objective

Unblock SCN-19 ("Sharon shares a Guardian article with a preview
card") and turn the post detail page into a richer, more demo-able
surface. After this BU lands:

- Members can paste a URL into the composer and see live-fetched OG
  preview data populate inline (Phase C / "magical")
- A clipboard-detection prompt offers to use a copied URL when the
  composer opens (Phase B)
- AM URL and link URL render through the same `<LinkPreviewCard>`
  primitive in two sizes (Phase A)
- Cards in the feed support the three-state model from D061: collapsed,
  expanded-in-place, detail page

Success looks like: log in as Eddie → click any seeded post in the
feed → it expands in place with the preview card visible → tap again
→ navigate to the detail page → the same preview card renders larger
underneath the post body. Compose a new post → paste a Guardian or
BBC URL → the title, description, image, and site name auto-populate.

---

## Scope

### Build in this session-cluster

This is a **multi-session BU**. The brief sequences three phases. Each
phase can be its own session with its own commit. The PR ships all
three together.

#### Phase A — schema + manual composer + card primitive

**Database / schema:**

- `prisma/schema.prisma` (MODIFY — add five nullable `link*` fields per D060)
- Run `npx prisma migrate dev --name add_link_share_fields` to land the
  additive migration. No backfill — existing posts unaffected.

**Validation:**

- `shared/validation/post.ts` (MODIFY — add zod fields per D060 §2;
  https-only URL constraint, length caps for title/description/site)

**Server — services / routers:**

- `server/services/post.ts` (MODIFY — `createPost` accepts the five
  link fields; `listPosts` projects them; `getPost` projects them)
- `server/routers/post.ts` (MODIFY — `create` and `list` input/output
  schemas extended)

**Client — composer:**

- `app/compose/page.tsx` + `app/compose/actions.ts` (MODIFY — add
  "Share a link?" toggle that expands to 5 fields; per SCN-19 manual
  fill works without auto-scrape)

**Client — card primitive:**

- `components/LinkPreviewCard.tsx` (new — accepts `linkUrl`,
  `linkTitle?`, `linkDescription?`, `linkImageUrl?`, `linkSiteName?`,
  `size: 'small' | 'large'`. Renders title + image + description +
  site name, the entire card is the click target per D061. Falls back
  to URL host when title is absent.)

**Client — card primitive consumers:**

- `components/PostCard.tsx` (MODIFY — render `<LinkPreviewCard
  size="small">` once for AM URL and once for `linkUrl` when present;
  remove the existing AM URL "Open in ActivistMailer" button. Both
  cards now render under the body.)
- `app/post/[id]/page.tsx` (MODIFY — same render pattern with
  `size="large"`)

**Test surface:**

- `tests/unit/post-service.test.ts` (MODIFY — fixtures gain link fields;
  null and populated cases both covered)
- `tests/unit/link-preview-card.test.tsx` (new — 6–8 cases: all-fields,
  title-only, image-only, no-title-falls-back-to-host, click target
  fires onAction with linkUrl, size variants render)
- `tests/integration/post-creation.test.ts` (MODIFY — happy path covers
  composer-with-link-fields)

#### Phase B — clipboard detection

**Client — composer:**

- `app/compose/page.tsx` (MODIFY — on mount, attempt
  `navigator.clipboard.readText()` inside try/catch. If returns valid
  URL, show "Post this URL from your clipboard? [host.tld/...]" prompt
  card above the form. Tap to accept = pre-fills `linkUrl` field and
  expands the link section. Tap to dismiss = stores the URL in
  `sessionStorage` keyed `compose.dismissed-clipboard-urls`; same URL
  in same session does not re-prompt.)

**Copy:**

- `docs/product/copy-library.md` (MODIFY — add
  `share.clipboard.prompt`, `share.clipboard.accept`,
  `share.clipboard.dismiss` per inbound-sharing.md; values already in
  the spec, just lift them in)

**Test surface:**

- `tests/unit/clipboard-prompt.test.tsx` (new — 4 cases: shows when
  clipboard has URL, hidden when clipboard is empty/garbage, dismiss
  state persists across remounts in same session, tap-to-accept
  populates linkUrl)

**Notes:**

- Use `navigator.clipboard.readText()`. iOS Safari requires a user
  gesture; the prompt shows the first time the composer is opened in
  a session and the API resolves naturally on user interaction.
- If the clipboard API throws (permission denied, no clipboard, headless
  browser), silently skip — composer works as before.
- Match URL with a simple regex: `/^https?:\/\/\S+$/`. Don't try to
  validate the URL is reachable; just that it's URL-shaped.

#### Phase C — magical OG scraper (server-side)

**API route:**

- `app/api/scrape-link/route.ts` (new — accepts POST with
  `{ url: string }`. Validates URL shape + https-only. Server-side
  fetches the URL with a 5s timeout and a real-browser User-Agent.
  Parses the HTML for OG tags (`og:title`, `og:description`,
  `og:image`, `og:site_name`) with `twitter:*` fallbacks. Returns
  `{ title?, description?, image?, siteName? }` or empty object on
  any failure. Errors are silent — the magical autofill is best-effort,
  not required.)

**Service:**

- `server/services/link-scraper.ts` (new — encapsulates the fetch +
  parse + cache logic. In-memory LRU cache keyed on URL with 5min TTL
  to dedupe within a session. Limit to 50 entries. No DB persistence
  — restart clears the cache.)

**Client — composer:**

- `app/compose/page.tsx` (MODIFY — on `linkUrl` change with debounce
  500ms, POST to `/api/scrape-link`. On response, populate the four
  remaining fields IF they are currently empty. If the user has typed
  into a field, never overwrite. Show subtle loading shimmer on the
  fields during fetch. On error or empty response, no-op — user fills
  manually.)

**Test surface:**

- `tests/unit/link-scraper.test.ts` (new — 6 cases: parses og:title,
  og:description, og:image, og:site_name; falls back to twitter:title;
  returns empty on 404 / timeout / non-HTML response; cache hit
  returns same result without re-fetching)
- `tests/integration/scrape-route.test.ts` (new — POST happy path,
  POST with bad URL, POST with non-https URL → 400, POST with
  unreachable host → empty response)

**Privacy / disclosure:**

Phase C surfaces a known privacy issue: the server-side fetch leaks our
app server's IP to the target. Per the user's design call this session,
the issue is recorded in `engineering-roadmap.md` as **B12** but is
explicitly **not blocking the demo**. The MVP composer does NOT show
a disclosure banner. (B12 will add one pre-launch if real members start
pasting arbitrary URLs.)

### NOT in this BU

| Item | Where it lands |
|---|---|
| Member-uploaded images | image-handling.md Phase 2 (separate BU) |
| Curated image gallery picker | image-handling.md Phase 1.5 (separate BU) |
| Outbound og:image card generation for shared GPS Action posts | image-handling.md Phase 1.5 + share-out-mechanics.md |
| `/share?url=` endpoint + bookmarklet | inbound-sharing.md path 3 (separate BU; explicitly downstream of this one) |
| Android Web Share Target manifest | inbound-sharing.md path 1 (separate BU) |
| Dedup check on link URLs | dedup-and-cosurfacing.md (BU-dedup; ideally lands first; gracefully no-ops if absent) |
| og:image moderation / safety scanning | image-handling.md Phase 2 |
| Native iOS share extension | inbound-sharing.md path 4 — engineering-roadmap B11 |

The brief is deliberately tight. Anything tangential is a different
BU's problem.

---

## Card three-state model (per D061)

The PostCard becomes a state machine with three states:

```
        ┌──────────────────┐
        │   COLLAPSED      │   ← default in feed
        │   (small)        │
        └─────┬─┬──────────┘
              │ │  body-tap, chevron-tap
              │ │  ↓
              │ │
        ┌─────┴─┴──────────┐
        │   EXPANDED       │   ← in-place, same feed scroll
        │   (in feed)      │
        │   (large)        │
        └─────┬─┬──────────┘
              │ │  body-tap, "Open thread →"
              │ │  ↓
              │ │
        ┌─────┴─┴──────────┐
        │   DETAIL PAGE    │   ← /post/[id]
        │   (large)        │
        └──────────────────┘
```

**State persistence**: session-only React state (`useState` lifted to
`FeedList`). No URL encoding. Reload = collapsed.

**Animation**: card height transitions 200ms ease-out on
expand/collapse. Use `<details>` element OR a manual height transition
— pick the approach that doesn't break F14 testid wiring.

**Accessibility**:

- Card root has `role="article"`
- Chevron is a `<button>` with `aria-expanded={true|false}` and
  `aria-controls` pointing at the content region
- "Open thread →" is a real `<a href="/post/${id}">`, not a JS-only nav
- Body-tap is wired via the card root's `onClick` AND `onKeyDown` (Enter
  / Space). Card root has `tabindex="0"`.

**Tap precedence (per D061)**:

- Click on chevron → toggle expand only
- Click on `<LinkPreviewCard>` → opens link in new tab
- Click on reaction → toggle reaction
- Click on comment-count link → /post/[id]
- Click anywhere else on card → expand or navigate (state-dependent)

The implementation uses `event.target` checks and `stopPropagation()`
on the inner targets so the body click handler only fires when the
user genuinely clicked the body region.

---

## `<LinkPreviewCard>` component spec

```tsx
interface LinkPreviewCardProps {
  linkUrl: string;
  linkTitle?: string | null;
  linkDescription?: string | null;
  linkImageUrl?: string | null;
  linkSiteName?: string | null;
  size: 'small' | 'large';
}
```

**Rendering rules**:

- Always renders the URL host as a fallback for `linkSiteName` if
  absent (`new URL(linkUrl).hostname.replace(/^www\./, '')`)
- Always renders `linkTitle` if present, else falls back to
  `linkUrl` (visible, truncated)
- Image area: 16:9 aspect ratio. If `linkImageUrl` absent, falls
  back to a placeholder SVG keyed by the URL host (e.g., bordeaux
  silhouette for unknown hosts; per D046 day-1 placeholder strategy)
- `size: 'small'`: image on left, content on right, max 2 lines of
  description, height ~96px
- `size: 'large'`: image on top (full width, 16:9), content below,
  up to 4 lines of description, no height cap

**AM brand mark** (per D060 §3):

When the card is rendering an AM URL (i.e., the post's
`activistMailerUrl`, not a generic `linkUrl`), display a small AM
brand mark — top-right corner of the card. Distinguishes "this is an
Activist Mailer action you can take" from "this is a news article being
shared." For MVP a small badge with text "AM" is fine; design call is
to land an actual AM logo/wordmark before the demo.

A boolean prop `isAmAction?: boolean` (defaults false) flips the
brand-mark on. `PostCard` passes `true` when rendering the AM URL,
`false` for the generic `linkUrl`.

**Click target**: the entire card is one `<a>` with `target="_blank"
rel="noopener noreferrer"` per D061. Inside the `<a>`, no other
interactive elements (the card is monolithic from a tap perspective).

**Testid**:

- Root: `data-testid="link-preview-card"` with `data-link-url={url}`
  and `data-size={size}` for selector reliability per F14

**Styling**:

- Background: `var(--colour-surface-raised)`
- Border: `1px solid var(--colour-border-subtle)`
- Border radius: `var(--radius-md)`
- Hover: `var(--colour-surface-hover)`, cursor pointer
- All values from design tokens per F15

---

## Files to create / modify

**New files:**

- `components/LinkPreviewCard.tsx`
- `components/CardChevron.tsx` (if expand/collapse warrants a dedicated
  component; otherwise inline)
- `app/api/scrape-link/route.ts`
- `server/services/link-scraper.ts`
- `tests/unit/link-preview-card.test.tsx`
- `tests/unit/clipboard-prompt.test.tsx`
- `tests/unit/link-scraper.test.ts`
- `tests/integration/scrape-route.test.ts`

**Modified files:**

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_link_share_fields/migration.sql`
  (auto-generated)
- `shared/validation/post.ts`
- `server/services/post.ts`
- `server/routers/post.ts`
- `app/compose/page.tsx`
- `app/compose/actions.ts`
- `components/PostCard.tsx`
- `app/post/[id]/page.tsx`
- `app/feed/page.tsx` (FeedList wraps PostCards in expand state)
- `tests/unit/post-service.test.ts`
- `tests/integration/post-creation.test.ts`
- `docs/product/copy-library.md`
- `prisma/seed.ts` (F10 seed gains link-share fields on demo posts +
  hero images for posts without `linkImageUrl`)
- `scripts/seed.ts` (narrative demo seed; SCN-19 Sharon's Guardian post
  becomes a real post with all 5 link fields populated)
- `public/seed-images/` (new dir; 5–7 stock images + placeholder
  per-post-type SVGs)

---

## Acceptance criteria

Each phase has its own DoD. The BU PR can land all three together OR
split into 3 commits — author's call.

### Phase A DoD

- [ ] Migration applied; `npx prisma migrate dev` produces a clean SQL
      file with 5 ADD COLUMN statements and nothing else
- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] New unit tests for `<LinkPreviewCard>` cover both sizes and the
      fallback rules
- [ ] Compose form has a "Share a link?" toggle; expanding shows the
      5 fields; submitting saves all 5; visiting the post afterwards
      shows the card
- [ ] AM URL renders as a `<LinkPreviewCard>` (manually constructed
      from `activistMailerUrl` since the AM has no scraped fields yet)
- [ ] `npm run trace:check` passes; matrix regenerated

### Phase B DoD

- [ ] Composer prompt appears when clipboard contains a URL and no
      previous dismissal in the session
- [ ] Tap-accept pre-fills `linkUrl` and expands the link form
- [ ] Tap-dismiss stores in `sessionStorage`; same URL in same session
      does not re-prompt
- [ ] Tests pass for all 4 cases above

### Phase C DoD

- [ ] `/api/scrape-link` returns parsed OG fields for a real news URL
      (test fixture: BBC, Guardian)
- [ ] Composer auto-fills the 4 remaining fields on URL paste with
      500ms debounce
- [ ] User-typed values are never overwritten by scrape
- [ ] Scrape failure (timeout / 404 / non-HTML) silently no-ops; manual
      fill still works
- [ ] X.com URL gracefully fails into manual fill (X aggressively
      blocks our UA — confirm test fixture captures this)
- [ ] In-memory LRU cache hits on duplicate URL within session; verify
      via test that fetch is only called once

### Cross-cutting DoD

- [ ] Post detail page (`/post/[id]`) renders both card primitive
      sizes correctly
- [ ] Card three-state model from D061 implemented: collapsed,
      expanded-in-feed, detail page
- [ ] D061 tap-precedence rules respected: chevron toggles only,
      `<LinkPreviewCard>` opens link only, reaction toggles only,
      body-tap goes deeper
- [ ] Seed file's posts include 2-3 link-share examples (Guardian,
      BBC, X.com) so the demo path is exercised on first reset
- [ ] Existing scenarios (SCN-18, SCN-20) still work — feed still
      lists posts, comments still post, reactions still toggle

---

## Notes for Claude Code

- **Read first**: D060, D061, D046, image-handling.md, inbound-sharing.md
  §1–4, scenarios.md SCN-19. The brief above leans on those — don't
  re-decide what they decided.
- **Reuse precedent**: PostCard already follows D061 implicitly for
  comment-count and reactions. The lift is adding chevron + body-tap
  expand state, plus the new card primitive.
- **F14 (testids)**: every new tap target gets a testid. F15 (design
  tokens): every new style uses a token, never a hex.
- **F06 boundaries**: `app/api/scrape-link/route.ts` calls
  `server/services/link-scraper.ts`; the service can call out to fetch
  but must NOT import from `@/server/db` (no DB needed for scrape).
- **Two-phase migration**: NOT required (additive nullable columns);
  single Prisma migration is correct per D060 §4.
- **No `any`** anywhere. The OG-tag parser returns
  `Record<string, string | undefined>` strictly typed.
- **Session brief discipline** (per working-rhythm.md): if you hit
  context pressure mid-phase, write a handoff in
  `docs/build/session-handoffs/` and stop. Don't rush phases C across
  a tired session.

---

## WCAG / accessibility — pre-launch hardening

The brief's accessibility rules above (role, aria-expanded, real
anchors, keyboard handlers, testids) are MVP table-stakes but not a
full WCAG 2.2 AA audit. Before launch, the card three-state model
and `<LinkPreviewCard>` need:

- **Focus management** — when a card expands, focus moves into the
  newly-revealed region; collapsing returns focus to the chevron
- **Screen-reader announcements** — expand/collapse state announced
  via live region; "Open thread →" tells SR users where the next
  navigation goes
- **Colour contrast** — card border + hover + AM brand mark all hit
  4.5:1 for text and 3:1 for UI components
- **Reduced motion** — `@media (prefers-reduced-motion)` disables
  the height transition; expand/collapse becomes instant
- **Touch targets** — chevron is at least 44×44px tappable area
  (currently F14-spec'd but worth re-verifying in the BU PR)
- **axe-core sweep** — once B02 (axe on CI) is wired, the card
  primitive gets a Storybook story and the sweep runs against it
  automatically

Tracked here (not as a separate roadmap row) because it's specifically
the surface area BU-link-share lands. Pre-launch sweep verifies it as
part of the broader WCAG pass that B02 enables.

---

## Related

- D060 — Post schema for link-share (the schema this BU lands)
- D061 — Global tap interaction pattern (the contract this BU embodies)
- D018 — Inbound sharing endpoint foundation (Phase B inherits)
- D046 — Image handling phased strategy (link images = day-1 URL only)
- SCN-19 — Sharon shares a Guardian article (primary scenario)
- B12 — Outbound scrape proxy + composer disclosure (deferred follow-up)
- working-rhythm.md — session discipline
- session-brief-template.md — this brief's parent format
