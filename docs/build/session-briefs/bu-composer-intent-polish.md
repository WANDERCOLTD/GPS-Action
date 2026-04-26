# Brief: BU-composer-intent-polish (demo polish)

**Status:** in flight (this session)
**Build Unit:** BU-composer (extends BU-fab-intent-picker)
**Followed by:** BU-composer-bespoke-per-intent (B brief — see sibling file)

## Why this brief exists

After BU-fab-intent-picker landed (PR #78), every FAB tile routes to
`/compose?intent=<slug>`, which renders the same `PostForm` with three
shallow knobs: heading, placeholder copy, and whether the link toggle
opens by default.

The user's read: **"all CreateNew after FAB open the same create form;
that form is weak."**

Two responses are on the table:

- **A (this brief)** — keep one shared `PostForm` but make per-intent
  differentiation visible and meaningful: banner, accent, reordered
  fields, distinct submit label.
- **B (follow-up brief)** — split into per-intent composers
  (`EventComposer`, `CulturalComposer`, …). Right shape long-term but
  carries 5–6 components + shared validation layer. Right time once
  date/time fields exist for Event/Meeting.

This brief covers **A only** — pre-demo polish.

## Latent bugs to fix in passing

While reading the composer to plan A I found two:

1. **`kind` slug never persists.** `app/compose/actions.ts:35` reads
   `formData.get('kind')` and passes it through, but
   `shared/validation/post.ts:postCreateSchema` expects `kindId` (UUID).
   The slug is silently dropped before `post.create` runs. Fix: action
   resolves slug → id via `post-kind.getBySlug` before validating.
2. **`happening_now` not in `KNOWN_INTENTS`.** `app/compose/page.tsx:21`
   omits it, so `/compose?intent=happening_now` falls back to a generic
   "New post" heading and the form has no idea it should set
   `urgency=true`. Fix: add to `KNOWN_INTENTS`, wire urgency in the form.

## Scope (build)

1. **`INTENT_META` registry** in `components/PostForm.tsx` (or a sibling
   `intent-meta.ts`) — single source of truth per intent for:
   - `icon` (lucide component)
   - `accent` (CSS var token, matching the FAB tile)
   - `banner` (heading + helper sentence)
   - `submitLabel`
   - `hideAM` (cultural)
   - `hideLinkToggle` (cultural)
   - `urgent` (happening_now → set urgency hidden field, red submit button)
2. **Intent banner** at top of form — accent strip on the left, icon,
   intent label, helper sentence. Read straight from `INTENT_META`.
3. **Field reordering / hiding**:
   - `link_share` → URL prompt at the top of the body section
     (link toggle stays open, fields below body unchanged)
   - `call_to_action` → AM URL field moved above body, with
     "Where to send recipients" microcopy
   - `cultural` → AM URL hidden, link toggle hidden, just title + body
     under bordeaux frame
   - `event` / `meeting` → small hint banner: "Time and date fields are
     coming. For now, write date/time in the body."
   - `happening_now` → red banner ("Posts as urgent — reviewers see it
     instantly"), red submit button, hidden `urgency=true` field
4. **Submit label per intent**: "Post call to action", "Share link",
   "Post outcome", "Post moment", "Post event", "Post meeting", "Post
   urgent alert", "Post" (default / undecided / thought).
5. **Slug → id resolution** in the server action.
6. **`happening_now` recognised** in `KNOWN_INTENTS` and `INTENT_HEADINGS`.

## Out of scope

- Date / time / RSVP fields for Event and Meeting (defer to B)
- Clipboard auto-prefill for link_share (defer to B)
- Bordeaux frame surrounding entire cultural composer (B can do that —
  here a coloured banner is enough)
- Send-for-Review wiring (D063, deferred)

## Tests

- `npm run typecheck && npm run lint && npm test` must pass
- Manual smoke: open FAB, tap each tile in turn, verify the banner +
  layout + submit label change visibly per intent
- Submit a `call_to_action` post with kindId set; verify
  `kindSlug=call_to_action` appears in the feed PostCard
- Submit a `happening_now` post; verify red flag + correct
  `kindSlug=happening_now` on the card

## Definition of done

- 11 tiles → visibly distinct compose experiences (without yet being
  separate components)
- Two latent bugs fixed
- All checks green, PR opened, auto-merge once CI green
