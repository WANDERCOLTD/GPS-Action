# SESSION BRIEF · BU-am-link-collapse — fold AM into the generic link primitive

_Brief version: 1.0 · Author: Paul + Claude · Date: 2026-04-26_
_Priority: composer UX cleanup. Direct follow-up to BU-link-share (D060)
and BU-composer / BU-am-link._
_Pairs with: D060 (link-share schema), the existing
`isAmAction` flag on `LinkPreviewCard`, and the Activist-Mailer
domain allowlist in `shared/validation/post.ts`._

---

## Objective

Stop treating the Activist Mailer URL as a special composer field.
Members paste any URL into the regular link-share field; the system
detects AM domains at render time and flips the "Send email" call-
to-action on the preview card. The dedicated `<ActivistMailerField />`
disappears from `PostForm`; the schema's `activistMailerUrl` column
stays for backwards compatibility (legacy rows still render).

Success: Eddie writing a Call-To-Action post pastes
`https://activistmailer.com/c/abc123` into the link field. The
preview card auto-detects the AM domain, shows the AM brand mark
(per D060 §3) and renders the action button as "Send email" instead
of generic "Open link". The composer no longer has a separate
"Activist Mailer URL (optional)" input.

---

## Scope

### Build in this session

**Domain detection helper:**

- `shared/validation/am-domain.ts` (new) — exports
  `isActivistMailerDomain(url: string): boolean` that reuses the
  existing `ACTIVIST_MAILER_ALLOWED_DOMAINS` env list. The function
  returns `false` on parse errors (no exceptions). Lives in
  `shared/` so both server (validation) and client
  (LinkPreviewCard) can import it without crossing boundary rules.

**Composer:**

- `components/PostForm.tsx` (MODIFY) — drop the import of
  `ActivistMailerField`; remove the two render slots (above body
  for `call_to_action`, below body for default); remove `hideAM`
  and `amFirst` from `IntentMeta` and the per-intent table; remove
  AM-related copy from per-intent banner text. The link-share
  field (already shipped via BU-link-share) is the new home for
  AM URLs.
- `components/ActivistMailerField.tsx` — **delete**. It has no
  remaining caller after PostForm is updated.
- `app/compose/actions.ts` (MODIFY) — drop the
  `activistMailerUrl` form-data read. Existing `linkUrl` reads
  unchanged. Server-side `createPost` continues to accept
  `activistMailerUrl` (optional) for backwards compatibility but
  the composer no longer sends it.

**Render path:**

- `components/LinkPreviewCard.tsx` (MODIFY) — add render-time AM
  detection. When `isAmAction` is undefined, infer it from
  `linkUrl` via `isActivistMailerDomain()`. Add a CTA element at
  the bottom of the card that reads **"Send email →"** when
  `isAmAction === true`, **"Open link →"** otherwise. The existing
  `isAmAction`-driven brand mark stays.
- `components/PostCard.tsx` (MODIFY) — keep the existing two-path
  render (legacy `activistMailerUrl` rows render via the existing
  AM path; new `linkUrl` rows render via the auto-detected path).
  No new conditional logic; LinkPreviewCard owns the detection.
- `app/post/[id]/page.tsx` (MODIFY) — same: existing AM render
  path stays; new render path (linkUrl) auto-detects.

**Validation:**

- `shared/validation/post.ts` (MODIFY) — `activistMailerUrl`
  validator stays (legacy posts may still set it directly via
  service-layer write). The composer just stops sending it.

**Tests:**

- `tests/unit/post-validation.test.ts` (MODIFY) — drop
  composer-side AM URL assertions if any; the validator itself
  is unchanged.
- `tests/unit/link-preview-card.test.tsx` (MODIFY) — add 2 cases:
  AM-domain `linkUrl` auto-flips `isAmAction` true and CTA reads
  "Send email"; non-AM domain CTA reads "Open link".
- `tests/unit/am-domain.test.ts` (new, 4 cases) —
  `isActivistMailerDomain` for: known AM domain, subdomain match
  (`mail.activistmailer.com`), unrelated domain, malformed input.
- `tests/integration/post-create.test.ts` (MODIFY) — drop the
  `activistMailerUrl` assertion in the "creates a post" path
  since the composer no longer submits it. Leave the schema-level
  test that confirms the validator still accepts the field for
  service-layer writes.
- `tests/unit/post-form.test.tsx` (MODIFY if it exists) — drop
  AM-field rendering assertions; assert the field is no longer in
  the DOM.

**Docs:**

- `CLAUDE.md` (MODIFY) — update the "Post composer" paragraph:
  the form's 4 fields become 3 (title, body, optional link URL,
  visibility), and the AM URL is "auto-detected from any link
  whose domain matches the AM allowlist."

### Do NOT touch

- `prisma/schema.prisma` — the `activistMailerUrl` column stays
  this BU. Schema rationalization (drop column, backfill into
  `linkUrl`) is the future BU-am-link-collapse-hard, not this one.
  Reason: hard-collapse needs an ADR + migration + data backfill;
  out of scope for the composer-UX fix the user asked for.
- `server/services/post.ts` — the `createPost` service still
  accepts `activistMailerUrl` (optional). No service-side change.
- Seed data — existing posts with `activistMailerUrl` still
  render through the legacy path.
- The `isAmAction` prop on `LinkPreviewCard` — preserved for
  backwards-compat callers; we just default it via detection
  when it's undefined.
- `entityMetadata` / admin surface — out of scope; the admin
  Post create form already doesn't have an AM URL field.

### Out of scope (deferred to follow-ups)

- **Hard collapse** — drop the `activistMailerUrl` column,
  backfill into `linkUrl`, write a `Post.linkKind` enum
  (`activist_mailer | external | mailto | ...`). Needs an ADR
  + migration. Tracked as **BU-am-link-collapse-hard** for a
  future session.
- **Mailto: links.** Not in this BU's detection. If a member
  pastes a `mailto:` URL, it gets the generic "Open link" CTA.
  Future work could detect protocol and show "Compose email."
- **Other dedicated-link types.** Sign petitions, donate links,
  etc. — same architectural pattern would apply but each is its
  own product decision.
- **Composer paste-detect hint.** When a member pastes an AM
  URL, we don't currently surface a hint ("This looks like an
  Activist Mailer link — recipients will see a 'Send email'
  button"). Lands later if member confusion appears.
- **Per-intent AM-prominence rules.** The old `amFirst` flag
  promoted AM above the body for `call_to_action` intent. The
  link-share field already handles that for general links. If
  `call_to_action` posts need a different field order, that's a
  composer-design follow-up.

---

## Contracts

### Inputs consumed

- `ACTIVIST_MAILER_ALLOWED_DOMAINS` env (existing) — same
  source-of-truth for both the validation regex and the new
  detection helper.
- `LinkPreviewCard.isAmAction` (existing prop) — preserved as an
  override; if a caller explicitly passes it, that wins.
- `post.linkUrl` (existing column) — the new home for AM URLs
  going forward.
- `post.activistMailerUrl` (existing column) — legacy; still read
  by render paths until BU-am-link-collapse-hard ships.

### Outputs produced

**`isActivistMailerDomain(url: string): boolean`** — pure function,
no side effects, false on parse failure.

**`LinkPreviewCard` CTA text:**

| Condition | CTA text |
|---|---|
| `isAmAction === true` (explicit or auto-detected) | "Send email →" |
| Otherwise | "Open link →" |

**`PostForm` field shape:**

```
title (required)
body (required)
[link-share fields — already shipped] (optional)
visibility (required)
```

(No more `activistMailerUrl` field.)

---

## Decisions confirmed before build (Paul, 2026-04-26)

These lock the open questions below.

1. **Soft collapse** — keep the `activistMailerUrl` schema column.
   No migration. Form drops the dedicated field; AM URLs paste
   into `linkUrl` going forward. Hard collapse is a future BU.
2. **Render-time domain detection** — `LinkPreviewCard` reads the
   URL host and matches against the env list. No new schema flag,
   no migration.
3. **AM domains** — env-configurable; the existing
   `ACTIVIST_MAILER_ALLOWED_DOMAINS` list is the source of truth
   (currently `activistmailer.com`; subdomain match included).
4. **CTA copy** — "Send email →" for AM-detected; "Open link →"
   for everything else.
5. **Composer paste-detect hint** — out for MVP.
6. **Existing AM rows** — keep rendering via the legacy
   `activistMailerUrl` path. They still get the AM brand mark
   and the new "Send email" CTA via the same detection logic
   when they flow through `LinkPreviewCard`.

---

## Open questions to surface to Paul

(All resolved above; preserved for the trail of rationale.)

1. **Soft vs hard collapse?** Soft (no schema change, just form
   + render). Hard (drop the column + backfill). Recommend soft.
2. **Detection mechanism?** Render-time domain match
   (recommended) vs schema flag with composer-side write.
3. **Subdomain matching?** Already `host === d || host.endsWith(\`.${d}\`)`.
   Confirm same behaviour for the new helper.
4. **CTA exact copy?** "Send email" recommended; alternatives
   "Email recipients", "Open in Activist Mailer".
5. **Hint when pasting an AM URL?** Out for MVP.

---

## Acceptance criteria

### Functional

- [ ] `<ActivistMailerField />` is no longer in the DOM at
      `/compose`, regardless of intent (no `call_to_action`
      "above body" treatment).
- [ ] Pasting `https://activistmailer.com/c/...` into the
      link-share field renders a preview card with the AM brand
      mark and a "Send email →" CTA at the bottom.
- [ ] Pasting `https://example.com/article` renders without the
      AM brand mark and with an "Open link →" CTA.
- [ ] Existing posts with `activistMailerUrl` still render the
      AM brand mark + "Send email →" CTA (the legacy render path
      passes the URL through `LinkPreviewCard` which auto-detects).
- [ ] `app/compose/actions.ts` does not write `activistMailerUrl`
      on new posts. Existing `createPost` calls still accept it
      (no service-layer change), so any callers writing directly
      via tRPC keep working.
- [ ] `isActivistMailerDomain()` is a pure function with the
      expected behaviour for: known domain, subdomain, unrelated
      domain, malformed URL.

### Non-functional

- [ ] `npm run typecheck` clean — zero errors
- [ ] `npm run lint` clean — zero errors (warnings OK)
- [ ] `npm test` all passing (existing + 4 new from
      `am-domain.test.ts` + 2 new in `link-preview-card.test.tsx`)
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean
- [ ] `ActivistMailerField.tsx` deleted; trace matrix
      regenerated.
- [ ] Every modified file's `@build-unit` header updated to
      append `BU-am-link-collapse` where the modification is
      meaningful (PostForm, LinkPreviewCard, am-domain helper).

### Communication

- [ ] PR description summarises the user-visible change, links
      this brief.
- [ ] Commit message: `feat(am-link-collapse): BU-am-link-collapse —
      fold AM into linkUrl + auto-detect`.
- [ ] Branch: `feat/bu-am-link-collapse`.

---

## Permission matrix

No changes. Composer auth + create gates unchanged.

---

## UI states

### Composer

| State | Trigger | What user sees |
|---|---|---|
| Compose any intent | Default | Title + Body + Link URL (optional) + Visibility. **No** AM URL field. |
| Pasted AM URL | Domain matches allowlist | (Future) — paste-time hint deferred. Today: nothing visible at paste; the AM treatment shows on the rendered card. |

### Feed / Detail render

| State | Trigger | What user sees |
|---|---|---|
| Post with `linkUrl` (AM domain) | New posts | LinkPreviewCard with AM brand mark + "Send email →" CTA |
| Post with `linkUrl` (other domain) | New posts | LinkPreviewCard, no AM mark, "Open link →" CTA |
| Legacy post with `activistMailerUrl` | Existing data | LinkPreviewCard via the existing legacy path; auto-detection flips `isAmAction` on |
| Post with neither | Plain post | No card |

---

## Tests required

**Unit (`am-domain.test.ts`):**

1. `isActivistMailerDomain('https://activistmailer.com/c/x')` → `true`
2. `isActivistMailerDomain('https://mail.activistmailer.com/...')` → `true` (subdomain)
3. `isActivistMailerDomain('https://example.com/path')` → `false`
4. `isActivistMailerDomain('not a url')` → `false` (no throw)

**Unit (`link-preview-card.test.tsx`):**

5. AM-domain `linkUrl` (no explicit `isAmAction` prop) → element
   tree shows AM brand mark + "Send email" CTA
6. Non-AM `linkUrl` → element tree shows "Open link" CTA, no
   brand mark

**Integration / regression:**

7. `post-create.test.ts` — composer payload no longer carries
   `activistMailerUrl`; `linkUrl` carries through correctly
8. Existing `post-list.test.ts` — still passes (no logic change in
   `listPosts`)

**Manual click-through:**

- `/compose` as Eddie → pick "Call to action" intent → no AM
  field visible → paste an AM URL into link field → preview card
  renders with brand mark + "Send email"
- `/feed` shows existing seeded posts (with `activistMailerUrl`)
  rendering with brand mark + "Send email"
- `/post/[id]` page renders the same way

---

## Known gotchas

- **Two render paths converge in `LinkPreviewCard`.** Both
  legacy (`activistMailerUrl`) and new (`linkUrl`) callers pass
  through the card. Detection happens once, in the card —
  callers don't need to know about it.
- **`isAmAction` prop becomes a soft override.** When undefined,
  the card detects from the URL. When explicitly `true` or
  `false`, the caller's value wins. Keeps existing tests / callers
  working.
- **`hideAM` / `amFirst` flags in `IntentMeta`.** Both removed
  in this BU. Future intents can't promote AM above the body
  via that flag — but the link-share field already lives at a
  consistent spot, so the `call_to_action` "AM above body"
  treatment is gone. If that turns out to matter visually,
  surface as a polish follow-up.
- **Legacy `activistMailerUrl` schema column stays.** The hard
  collapse (drop column + backfill) is intentionally deferred.
  The column is still readable + writable; the composer just
  stops sending it.
- **CTA i18n.** "Send email" / "Open link" are English-only
  copy for MVP. Future i18n pass will need to thread these
  through the copy library.
- **CTA placement.** Sits at the bottom of the preview card
  — already a tap target via the wrapping anchor. No new
  interactive element (per D061 single-anchor rule).

---

## Definition of done (per `working-rhythm.md` §3)

### Functional

- [ ] All acceptance criteria pass
- [ ] Manual click-through completed in dev: `/compose`, `/feed`,
      `/post/[id]`
- [ ] Open questions resolved (locked above)

### Mechanical

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test` all passing
- [ ] `npx prettier --check .` clean
- [ ] `npm run trace:check` clean

### Discipline

- [ ] `ActivistMailerField.tsx` deleted (not commented out)
- [ ] No orphan imports of `ActivistMailerField` anywhere
- [ ] `PostForm.tsx` `IntentMeta` no longer carries `hideAM` or
      `amFirst` flags
- [ ] No PII in any log line touched
- [ ] Layer boundaries respected
- [ ] No schema changes in this BU; no migrations

### Communication

- [ ] PR description, links this brief
- [ ] Commit + branch follow conventions
- [ ] CLAUDE.md "Post composer" paragraph updated

---

## File-header convention

Every modified file appends `BU-am-link-collapse` to its
existing `@build-unit` header (alongside `BU-composer`,
`BU-link-share`, etc.). New files get a fresh header naming this
BU.

---

## Context

**Specs:**

- `docs/architecture/decision-log.md` — D060 (link-share + AM
  brand mark on `LinkPreviewCard`), D045 (post visibility).
- `docs/process/api-contract-discipline.md` — for the validation
  layer.

**Existing code to read first:**

- `components/ActivistMailerField.tsx` — the field being deleted
- `components/PostForm.tsx` — the call sites being removed
- `components/LinkPreviewCard.tsx` — the card gaining auto-detection
- `shared/validation/post.ts` — the existing AM domain validator
  (the new helper reuses the same env list)
- `app/compose/actions.ts` — drops the `activistMailerUrl`
  form-data read

---

## What this brief does NOT cover

1. Schema rationalization (BU-am-link-collapse-hard)
2. mailto: detection
3. Other dedicated-link types (sign petitions, donate)
4. Composer paste-detect hint
5. Per-intent field-ordering rework
6. Internationalisation of the new CTA strings

---

## What lands after this session

- Composer is one-fewer-field for every intent
- Members paste any URL — the system figures out what it is
- Activist Mailer URLs still get their AM brand mark and a
  clear "Send email" call-to-action; the user-visible
  experience stays consistent
- The legacy `activistMailerUrl` column is now writable only
  via the service layer (or seed); no more form path
- Sets the pattern for future link-kind detections (sign /
  donate / mailto) — same `isXyzDomain()` helpers, same
  render-time CTA selection
