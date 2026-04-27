---
slug: bu-composer-bespoke-per-intent
status: abandoned
superseded_by: bu-composer-intent-polish
note: "Direction superseded by per-intent banner approach"
---
# Brief: BU-composer-bespoke-per-intent (the B build)

**Status:** drafted, not started
**Build Unit:** BU-composer-bespoke
**Predecessor:** BU-composer-intent-polish (A — shared form polish, demo-time)
**Spec basis:** D044, D061, D062, design-philosophy.md

## Why this brief exists

A (shared form polish) is enough for the next demo, but the user's
strategic read is "B for real" — bespoke composers per intent.

The right time for B is when at least one intent gains structured
fields the shared form can't represent without bloating: Event/Meeting
need date / time / location pickers, and Call to Action benefits from
making AM URL the primary affordance.

## Goals

- Each FAB tile routes to a dedicated composer component
- Shared validation, audit-log, and post-create plumbing remain
  centralised — only the form layer is per-intent
- Bespoke fields land where they belong: dates on Event, RSVP on
  Meeting, URL-paste-first on Link share
- `/compose?intent=<slug>` continues to be the entry URL — Next route
  decides which composer to render, OR `intent=undecided` falls through
  to a generic kind-picker view

## Scope

### 1. Shared layer (refactor)

- Extract `useComposerSubmit(intent)` hook — owns useTransition,
  errors state, handleSubmit, slug→id resolution, server action call
- Extract `<TitleField>`, `<BodyField>`, `<VisibilityField>`,
  `<ActivistMailerField>` (already exists), `<ShareLinkFieldset>`,
  `<SubmitRow label="…" />` as primitive form fragments
- Move INTENT_META registry to `components/composer/intent-meta.ts`
  (lift from BU-composer-intent-polish)

### 2. Composers (one component each)

Each composer assembles primitives in a layout that matches the intent.

| Slug | Composer | Distinctive fields / behaviour |
|---|---|---|
| `happening_now` | `<UrgentComposer>` | Red frame; "What's happening, where, what to do" structured prompts; AM URL optional but visually deprioritised; submit = red "Post urgent alert" |
| `call_to_action` | `<CallToActionComposer>` | AM URL is the *primary* visual element (large, framed, "Where members will send their email"); body is supporting context; submit = "Post call to action" |
| `link_share` | `<LinkShareComposer>` | URL paste-first hero (large input at top with "Paste link" affordance); body becomes "Why members should read this" 2-line note; clipboard auto-prefill on focus |
| `cultural` | `<CulturalComposer>` | Bordeaux frame around entire form; just title + body; no AM, no link, no visibility chooser (always public-with-defaults); submit = "Post moment" |
| `outcome` | `<OutcomeComposer>` | Optional "Linked to which post?" field for closing-the-loop framing (hooks into D018 share-graph); submit = "Post outcome" |
| `thought` | `<ThoughtComposer>` | Just title + body, casual; visibility default = authenticated_only |
| `event` | `<EventComposer>` | **New fields**: starts_at (date+time), ends_at (optional), location text, RSVP toggle. Schema additions required. |
| `meeting` | `<MeetingComposer>` | **New fields**: meeting_at (date+time), join URL (optional), agenda body. Schema additions required. |
| `undecided` | `<KindPickerComposer>` | Top-of-form selector → on change, route-replace to `/compose?intent=<chosen>`. No schema changes; just routes. |

### 3. Schema additions (Event / Meeting only)

Two paths — pick during the build:

- **Path A — fields on Post.** Add `eventStartsAt`, `eventEndsAt`,
  `eventLocation`, `meetingJoinUrl` directly to Post. Cheap, but Post
  table grows wide for fields only some kinds use.
- **Path B — `PostExtension` polymorphic table** keyed by `(postId,
  kindSlug)`, JSON column. More flexible, indirection cost on read.

Recommendation: **Path A** for MVP — only two intents need fields, the
columns are nullable, and read paths stay simple. Revisit if a third
kind adds bespoke fields.

### 4. Validation

`postCreateSchema` becomes a discriminated union on `intent`:

```ts
const baseSchema = z.object({ title, body, visibility, kindId, urgency });
const eventSchema = baseSchema.extend({
  intent: z.literal('event'),
  eventStartsAt: z.coerce.date(),
  eventEndsAt: z.coerce.date().optional(),
  eventLocation: z.string().trim().min(1).max(200),
});
// …one variant per composer with bespoke fields
```

Server action picks the right variant by `formData.get('intent')`.

### 5. Tests

- One render-smoke test per composer (data-testid present, submit works)
- Validation unit tests per discriminator variant
- Date/time edge cases on EventComposer (past start dates → warning,
  ends-before-starts → error)
- Visual regression deferred (no screenshot tooling yet — log to
  engineering-roadmap)

## Out of scope

- Real RSVP attendance tracking (separate BU)
- Calendar export (.ics) — log to parking-lot
- Recurring events — log to parking-lot
- Image upload on cultural moments — depends on BU-media (not yet
  scoped)

## Sequencing

Recommended order, smallest blast radius first:

1. Refactor shared primitives (no UX change)
2. `<UrgentComposer>`, `<CallToActionComposer>`, `<CulturalComposer>`,
   `<OutcomeComposer>`, `<ThoughtComposer>`, `<KindPickerComposer>` —
   no schema changes, demoable in same PR
3. Schema migration adding event/meeting fields (separate PR)
4. `<EventComposer>` + `<MeetingComposer>` (separate PR)
5. `<LinkShareComposer>` clipboard prefill (separate PR — needs
   navigator.clipboard plumbing)

## Definition of done

- All 11 FAB tiles route to a dedicated composer (or
  `<KindPickerComposer>` for undecided)
- Shared primitives + `useComposerSubmit` hook keep validation /
  audit logic in one place
- Event and Meeting persist `starts_at` etc. and surface them on
  PostCard
- Tests + lint + typecheck green
