---
slug: bu-fab-intent-picker
status: shipped
shipped_in: "#78"
phase: 2
---
# SESSION BRIEF · BU-fab-intent-picker — single FAB → tile picker → composer (D044)

_Brief version: 1.0 · Author: Paul (via Claude) · Date: 2026-04-26._

Pairs with **D044** (FAB intent-cards composer), **D048** (post taxonomy — deferred), **D061** (tap pattern). Read those first.

---

## Objective

Replace every "create something new" entry point with a **single primary FAB**. Tap → tile picker → 1-tap to the right composer with type-specific defaults pre-set. Minimum clicks for any post: **3** (FAB → tile → submit-after-fill).

The "Compose" item in the top nav goes away; the urgent-only red FAB on `/feed` becomes one tile of many. One affordance for everything new.

After this BU lands: a senior-user demo shows the breadth of post types in a single tap; a member who doesn't know what they want sees an honest menu of options and one "I don't know" escape hatch.

---

## Scope

### 1. Schema — D062 (revised) + D063

> **Revised in place:** the original brief proposed `Post.kind String?` with `alert` as a peer label. After review, `alert` was identified as orthogonal to kind (per D058's already-orthogonal model on Request) and the kind axis was promoted to a managed table so admins can edit per-row policy. See D062 revision history in the decision log.

Two ADRs land in this BU:

- **D062 (revised in place):** PostKind as a managed table; orthogonal `Post.urgency` flag; `AlertCategory` collapses into `PostKind`.
- **D063 (new):** Send-for-Review pattern — composer ships two buttons (`Post`, `Send for Review`); reviewer queue gains publish + archive actions.

```prisma
model PostKind {
  id              String   @id @default(uuid())
  slug            String   @unique
  displayName     String
  icon            String?
  sortOrder       Int      @default(0)
  isAlertEligible Boolean  @default(false)
  createdAt       DateTime @default(now())
  deletedAt       DateTime?
}

model Post {
  kindId   String?
  kind     PostKind? @relation(fields: [kindId], references: [id], onDelete: SetNull)
  urgency  Boolean   @default(false)
}
```

Code defines the **set of slugs**; admin manages **per-row policy** (`isAlertEligible`, `displayName`, `sortOrder`, soft-delete). Slugs are the join key between code labels and DB rows — between an enum (locked) and a free-form string (no shared schema).

Seeded with eight rows; two flagged alert-eligible:

| slug | displayName | isAlertEligible |
|---|---|---|
| happening_now | Happening now | ✅ |
| meeting | Meeting | ✅ |
| cultural | Cultural moment | — |
| call_to_action | Call to action | — |
| outcome | Outcome | — |
| thought | Just a thought | — |
| link_share | Share a link | — |
| event | Event | — |

`Post.urgency` is the orthogonal alert flag — composer enforces that `urgency=true` is only allowed when the selected `PostKind.isAlertEligible` is true. Service double-checks at write time.

Time-bound logic for `event` / `meeting` is deferred to a follow-up BU.

Migration drops `AlertCategory` (rows merge into `PostKind`); adds `Post.kindId` + `Post.urgency`; renames `Request.alertCategoryId` → `Request.kindId`. Hand-written so existing seeded data survives the rename.

### 2. The picker tiles

| # | Tile | Icon (lucide) | Lands at | Pre-fills |
|---|---|---|---|---|
| 1 | 🔥 **Urgent — happening now** | `alert-triangle` (red) | `/alert/new` (BU-requests-urgent) | category preselected if only one |
| 2 | 📰 **Share a link** | `link` | `/compose?intent=link_share` | "Share a link?" toggle expanded |
| 3 | ✊ **Call to action** | `megaphone` | `/compose?intent=call_to_action` | AM URL field highlighted; AM brand mark hint |
| 4 | 🕊️ **Cultural moment** | `dove` (or `feather`) | `/compose?intent=cultural` | bordeaux marker styling cue; title placeholder ("Shabbat Shalom" etc) |
| 5 | 📌 **Outcome — what happened** | `pin` | `/compose?intent=outcome` | title placeholder ("We sent 200 emails…") |
| 6 | 💬 **Just a thought** | `message-circle` | `/compose?intent=thought` | plain |
| 7 | 📅 **Event** | `calendar-days` | `/compose?intent=event` | placeholder ("Saturday morning vigil") + note "(time-bound fields coming soon)" |
| 8 | 👥 **Meeting** | `users` | `/compose?intent=meeting` | placeholder ("Writers group — Sun 19:00") + same note |
| 9 | 🚩 **Flag a problem post** | `flag` | (creates a `flag` Request — defer until BU-requests-vetting) | — |
| 10 | ✏️ **Suggest an edit** | `pencil` | (creates an `edit_request` Request — defer) | — |
| 11 | ❓ **I don't know** | `help-circle` | `/compose?intent=undecided` | type **selector** inside the form (see §3) |

Tiles 9 and 10 render as **disabled** (grey, "coming soon" tooltip) until BU-requests-vetting ships their backing Request creation flow. Visible-but-disabled is deliberate per "show as much app surface as possible" — discovery now, action later.

### 3. The "I don't know" form

When a user taps tile 11 → `/compose?intent=undecided`:

- Composer renders with the **same fields as a normal post** (title, body, AM URL, link toggle, visibility)
- **PLUS** at the top: a `<select>` labelled "What kind of post is this?" with options:
  - "Just a thought" (default, `kind=thought`)
  - "Cultural moment"
  - "Outcome — what happened"
  - "Call to action"
  - "Share a link"
  - "Event (time/place)"
  - "Meeting (time/place)"
- Picking from the selector applies the same defaults as the dedicated tile (e.g. picking "Cultural moment" applies bordeaux marker styling cue)
- On submit: `Post.kind` is set to the chosen value

**Click count for I-don't-know path:** FAB (1) → tile (2) → pick from selector (3) → submit (4). One extra click vs the direct path; acceptable cost for the discovery.

### 4. Visual chip on post cards

Posts with `kind` set render a small chip in the card header (next to the timestamp):

- "Cultural moment" → bordeaux chip per design-philosophy.md cultural marker
- "Call to action" → primary-blue chip
- "Event" / "Meeting" → indigo chip (info colour)
- "Outcome" → success-green chip
- "Share a link" / "Just a thought" → no chip (the link card OR plain body is the visual signal)
- "Alert" → red chip (already happens via the urgent flag — unchanged)

Plain posts (`kind: null`) render unchanged.

### 5. Routing — what gets removed

- "New post" link in `/feed` page header — **removed**
- "Compose" link in `<AppNav>` — **removed**
- The dedicated red urgent FAB component (`<AlertFAB>`) — **kept but folded INTO the new picker** as tile #1. The bottom-right red triangle now opens the picker, not jumps directly to /alert/new.

The new component is a single `<IntentFab>` that lives globally in the layout (visible on every authed page), not just `/feed`.

---

## NOT in this BU

| Item | Where |
|---|---|
| Time-bound fields on Event / Meeting (startsAt, endsAt, RSVP) | BU-events-meetings (future) |
| Tile 9 / Tile 10 actually creating Requests | BU-requests-vetting (where flag + edit_request flows ship) |
| Per-kind feed filter ("show me only Cultural posts") | Future feed-filter BU |
| Custom kind labels admins can add | BU-admin-crud |
| Persisting "preferred default tile" per user | post-demo polish |

---

## Files to create / modify

**New files:**

- `components/IntentFab.tsx` — the FAB button + modal/sheet with tile grid (client component; manages open/close state)
- `components/IntentTile.tsx` — single tile (icon + label + disabled-state)
- `app/compose/IntentSelector.tsx` — the type `<select>` for the "I don't know" path (client; reads URL `?intent=`, controls a hidden form input)
- `prisma/migrations/<ts>_add_post_kind/migration.sql` — single ADD COLUMN
- `tests/unit/intent-fab.test.tsx` — renders tile grid, dispatches to right URL on tile click, disabled tiles don't navigate
- `tests/unit/intent-selector.test.tsx` — selector reflects `?intent=`, updates hidden input on change

**Modified files:**

- `prisma/schema.prisma` — add `kind String?` on Post
- `shared/validation/post.ts` — accept `kind` as optional string in `postCreateSchema` (max 50 chars)
- `server/services/post.ts` — `createPost` persists `kind`; `listPosts` projects it
- `components/PostCard.tsx` — render kind chip when set
- `app/compose/page.tsx` — read `?intent=` query param, pass to `<PostForm>`
- `components/PostForm.tsx` — accept `intent` prop; if `intent === 'undecided'` render `<IntentSelector>` at top; pre-fill body/title placeholders per intent
- `app/layout.tsx` — render `<IntentFab>` for authenticated users (replaces `<AlertFAB>` from #75)
- `app/feed/page.tsx` — remove the "New post" link (the FAB replaces it); remove `<AlertFAB>` import
- `components/AppNav.tsx` — remove Compose link from nav
- `eslint-rules/canonical-areas.json` — add `intent` area (was previously `compose` for the form, `alert` for the old FAB; the new FAB and tile grid get `intent` testids)
- `docs/process/testid-convention.md` — add `intent` row
- `docs/architecture/decision-log.md` — add **D062** ADR (Post.kind nullable string + deferred-taxonomy stance)

---

## Acceptance criteria

- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] `npm run trace:check` passes
- [ ] Migration runs cleanly; existing posts unaffected
- [ ] FAB visible on every authed page (layout-level)
- [ ] Tap FAB → modal with 11 tiles renders
- [ ] Tiles 9 + 10 disabled with tooltip; clicking does nothing
- [ ] Each enabled tile routes to the correct destination with correct query param
- [ ] Composer reads `?intent=` and pre-fills fields per intent (title placeholder, link toggle open, AM field highlight, etc)
- [ ] "I don't know" tile renders the type selector at the top of the composer
- [ ] Submitting any composer persists `Post.kind`
- [ ] Feed renders kind chips on posts with `kind` set
- [ ] D044 / D061 contracts respected (FAB is single tap target, tile body-tap = action, no overloaded tap regions)
- [ ] Old "New post" link gone from feed; old "Compose" link gone from AppNav
- [ ] After merge: walk the demo path below

---

## Demo path post-merge

Pre-flight: pull main, `npx prisma migrate deploy`, `npm run db:seed`, restart dev.

1. Log in as **Eddie**
2. Tap the FAB (now a single button, not specifically red — colour TBD; suggest accent-blue with a `+` icon, urgent-red is reserved for the alert tile inside the picker)
3. Picker pops up — 11 tiles arranged in a grid
4. Tap **"Just a thought"** → composer opens with plain defaults → write + submit → post in feed has no chip (the kind is `thought` but plain doesn't display)
5. Tap FAB again → tap **"Cultural moment"** → composer opens with bordeaux styling hint + Shabbat placeholder → submit → post has bordeaux "Cultural" chip
6. Tap FAB → **"I don't know"** → composer opens with the type selector at top → pick "Event" → submit → post has indigo "Event" chip
7. Tap FAB → **"Urgent"** → goes to existing alert composer (BU-requests-urgent) — confirm the integration
8. Tap FAB → **"Flag a problem post"** → tile is disabled, "coming soon" tooltip — confirm graceful future-affordance

That's the demo: every post type discoverable in a single FAB tap.

---

## D044 / D061 / D062 in code

- **D044 — FAB intent-cards composer:** this BU is D044 made real. Tile model = intent-cards model.
- **D061 — tap contract:** FAB is a single tap target (no nested actions). Each tile is one tap target. Modal close-button is its own target. No body-tap on tiles fires anything other than the tile's own dispatch.
- **D062 (new) — Post.kind label:** authorise the nullable string field. Frame the decision: not an enum per D048's "PostType deferred" stance, but a label that the composer + feed use today and that future taxonomy work can promote to enum without a schema rebuild.

---

## Open questions / risks

1. **Picker layout** — bottom sheet (mobile-first) vs centered modal (desktop)? Suggest bottom sheet on viewports < 640px, modal otherwise. Confirm when the design lands.
2. **FAB colour** — currently urgent (red); the new picker FAB should NOT be red (red is the URGENT tile inside). Suggest accent-blue with a `+` icon; the URGENT tile inside the picker keeps the red treatment.
3. **Picker discoverability for new users** — first launch could show a one-time tooltip ("Tap this to share anything"). Defer to onboarding work.
4. **Kind chip on posts** — not all kinds need chips (link/thought are silent). Confirm the chip list above.

---

## Related

- D044 — FAB intent-cards composer (this BU realises)
- D048 — Post axes taxonomy + deferred PostType (the stance D062 honours)
- D061 — Global tap interaction pattern
- D062 (new, drafted in this BU) — Post.kind label + deferred-enum stance
- BU-requests-urgent — alert tile is a dependency (must merge first); this BU folds the existing AlertFAB into the new picker
- BU-link-share — link-share tile uses the existing composer toggle
- design-philosophy.md (cultural-marker styling, no manufactured urgency)
- working-rhythm.md — session discipline
