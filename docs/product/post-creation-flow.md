> **Status note — April 2026:**
>
> This doc was drafted before the ERD Slice 2 minimal session. Its
> 7-value PostType list (`share_link`, `call_for_action`, `boost`,
> `event`, `general`, `outcome`, `incident_report`) is preserved below
> as useful starting material — but it is **NOT** the authoritative
> taxonomy.
>
> Per **ADR D048** (Post axes taxonomy), the final PostType (and
> related PostTone) are deferred until the composer design session
> (BU-composer). D048 establishes that Post varies along 10
> orthogonal axes; this doc's list collapses several of those axes
> into a single enum, which D048 explicitly defers.
>
> Specifically:
>
> - `boost` is not a post type — it's a verdict per D017
> - `cultural_moment` is better modelled as a tone (Axis 2) than a type
> - The split between "intent" (what the author wants) and "function"
>   (what artefact this is) should be two axes, not one conflated
>   value
>
> Use this doc as starting material for composer design, not as a
> decided spec. The list below will be revised when the composer
> session runs.
>
> See: `docs/architecture/decision-log.md` D048 ·
> `docs/product/parking-lot.md` "PostType taxonomy" entry

# Post creation flow

**Purpose:** Define how members create posts in GPS Action — specifically
the intent-first FAB-card model that radically reduces friction for the
most common cases (sharing a link, calling for action) while preserving
flexibility for unusual ones.

**Status:** Architectural + product. Affects ERD Slice 2 (Post fields)
and the composer Build Unit. Will become §3.36 of feature spec.

**Build Unit:** BU-003a (Composer foundation) and BU-003b (Intent cards)
— to be created.
**Related ADR:** D044 (Intent-first post creation — FAB cards model).
**Related:** `design-philosophy.md` (one-click is king),
`inbound-sharing.md` (clipboard detection feeds into composer),
`dedup-and-cosurfacing.md` (dedup runs after compose),
`deep-linking-and-tracking.md` (visibility chosen at compose time),
`image-handling.md` (hero image fetched from URLs at compose time),
`share-out-mechanics.md` (post → share follows immediately).

---

## The friction problem this solves

### What native WhatsApp posting feels like

Sharon pastes a link into a WhatsApp group:

1. Open WhatsApp group
2. Paste URL (1 tap, system clipboard)
3. WhatsApp auto-generates link preview
4. Optionally add a sentence
5. Tap Send

**~5 taps, plus typing.** WhatsApp gets out of her way.

### What a generic "type-picker first" composer feels like

Sharon opens GPS Action and wants to share the same link:

1. Tap FAB (+ New Post)
2. Pick post type from dropdown ("Action — Boost")
3. Type the body
4. Add the URL (separate field?)
5. Pick region tag (optional but visible)
6. Tap Post
7. Dedup check / share modal opens
8. Pick share destinations
9. Confirm
10. ... continue

**~14+ taps, plus typing.** Three times the friction of WhatsApp for the
same outcome.

### The diagnostic

The generic composer treats every post the same. But posts come in
**shapes**:

- Most posts are share-a-link
- Some are call-for-action
- Some are event announcements
- Some are general writing

A "share-a-link" post needs the URL field, can auto-fill the rest, and
benefits from minimal compose. A "call-for-action" post needs a clear
ask and urgency. An "event" post needs date/location. Forcing them all
through the same composer adds friction for every case.

The fix: **intent-first composers** that adapt to what the member is
trying to do.

---

## The FAB cards model

### What members tap

The floating action button (FAB) — labelled `+ New` — opens a small
overlay:

```
What kind of post?

🔗 Share a link              [primary card if clipboard has URL]
📢 Call for action now
✊ Boost something we should amplify
📅 Tell us about an event
✏️ Just write something
🤔 I'm not sure
```

Each card is a tappable target. Tapping opens a **purpose-shaped
composer** for that intent. The composer has the right fields, smart
defaults, and minimal asks for that intent's typical use.

### Card 1: 🔗 Share a link

The fastest path. Used when a member has a URL they want others to see
and amplify.

**Smart behaviours:**

- Clipboard detection: if the clipboard contains a URL when the FAB
  opens, this card is highlighted ("Detected URL — tap to share")
- Auto-paste the clipboard URL into the composer's URL field on tap
- Auto-fetch og:title, og:description, og:image from the URL once
  pasted

**Composer shape:**

```
[Detected URL field — pre-filled]
https://bbc.co.uk/iplayer/...

[Auto-fetched preview card — visible immediately]
┌──────────────────────────────────┐
│ [og:image]                       │
│ BBC iPlayer — Question Time      │
│ Discussion of recent Israeli...  │
└──────────────────────────────────┘

[Optional sentence field]
"Add a thought (optional)"
[                                   ]

[Visibility — collapsed; defaults to public]
Visibility: Public ▾

[Group — optional; collapsed]
Relevant to: (none) ▾

[Post button]
```

**Default values:**

- Post type: `share_link` (a sub-type of "boost" semantically; see schema below)
- Visibility: `public`
- Region: none (national / global)
- Group tags: none
- Hero image: from og:image fetch

**Friction count:**

1. Tap FAB
2. Tap "Share a link" card
3. (URL auto-pasted, preview shown)
4. (Optional) type one sentence
5. Tap Post

**4-5 taps. Comparable to native WhatsApp.**

### Card 2: 📢 Call for action now

Used when the member wants to galvanise the network around an immediate
action. Higher visual urgency, prompts for clear ask.

**Composer shape:**

```
What's the ask?
[Bold, large input — placeholder: "Email your MP today..."]

Why now? (optional context)
[Smaller multiline — placeholder: "There's a vote tomorrow..."]

[Optional URL — collapsed]
Add a link ▾

[Optional deadline — collapsed]
By when? ▾

[Visibility]
Visibility: Public ▾

[Region — defaults to national]
Region: National ▾

[Post button — primary action colour, slightly larger]
```

**Default values:**

- Post type: `call_for_action`
- Visibility: `public`
- Region: `national`
- Group tags: none

**The ask field is prominent.** Members must put the ask up front — no
burying the lead. This is intentional UX shaping toward clarity.

### Card 3: ✊ Boost something we should amplify

The general "amplify this" card. Less link-focused than card 1, more
about flagging "this matters, share it widely."

**Composer shape:**

```
What needs amplifying?
[Multiline body field — primary]

[Optional URL]
[                                   ]

[Optional hero image — pulled from URL or pick]
Add image: From URL / Bank ▾

[Visibility]
Visibility: Public ▾

[Region]
Region: National ▾

[Group]
Relevant to: (none) ▾

[Post button]
```

**Default values:**

- Post type: `boost`
- Visibility: `public`
- Region: `national`

The body is the focus. URL is secondary. Useful when the member wants
to write commentary first, link as supporting evidence.

### Card 4: 📅 Tell us about an event

For announcing events members might attend or amplify.

**Composer shape:**

```
What's the event?
[Title — single line]

When?
[Date picker]
[Time picker]

Where?
[Location — text or map picker if available]

What's it about?
[Multiline body]

[Optional URL — registration page, etc.]
[                                   ]

[Optional hero image]
Add image ▾

[Visibility]
Visibility: Public ▾

[Region — defaults to event's location region if detected]
Region: Manchester ▾

[Group]
Relevant to: (none) ▾

[Post button]
```

**Default values:**

- Post type: `event`
- Visibility: `public`
- Region: tries to infer from event location; otherwise national
- Hero image: scraped from URL if provided, else type-default

Event-specific fields (date, time, location) are required.

### Card 5: ✏️ Just write something

A general-purpose composer for posts that don't fit other intents —
opinion pieces, reflections, internal coordination, etc.

**Composer shape:**

```
What's on your mind?
[Multiline body — large primary field]

[Optional URL]
[                                   ]

[Optional title — collapsed]
Add a title ▾

[Visibility — defaults to members_only for this card]
Visibility: Members only ▾

[Region]
Region: National ▾

[Group]
Relevant to: (none) ▾

[Post button]
```

**Default values:**

- Post type: `general`
- Visibility: `members_only` (more conservative; this is the "I'm just
  writing" card, not the "this is for the world" card)
- Region: `national`

This card is the closest to a traditional generic composer. It's the
right choice when none of the more shaped cards match the intent.

### Card 6: 🤔 I'm not sure

Opens the **fully generic composer** with all fields visible and a
post-type-picker dropdown at the top. This is the escape hatch.

**Composer shape:**

```
What kind of post is this?
[Dropdown — "Pick a type..."]
  ◯ Share a link
  ◯ Call for action
  ◯ Boost
  ◯ Event
  ◯ General
  ◯ Outcome (something we accomplished)
  ◯ Incident report (sensitive)

[All composer fields visible — body, URL, region, visibility, group, image]

[Post button — disabled until type chosen]
```

**Default values:** none until type chosen.

The generic composer is **always available** for cases the cards don't
cover. It's the "I know what I want but no card matches" path.

---

## Help patterns throughout

### At the FAB tap

The cards adapt subtly based on context:

- **Clipboard URL detected:** "Share a link" card is highlighted with a
  small pill ("Detected: bbc.co.uk")
- **Recent activity in the feed about urgency:** if there's a "Call for
  action" post in the last hour with high engagement, the "Call for
  action" card has a small note ("Active: 3 calls in the last hour")
- **First-time poster:** a one-time tip below the cards: "Pick the one
  closest to your intent — you can always change it before posting"

These are **subtle, never blocking, never repeated**. One contextual
hint maximum at a time.

### During composition

Help arrives as the member types:

- **URL paste detection.** If the member pastes a URL into a non-URL
  field, offer to move it: "Looks like a URL — add it as a link?"
- **Length guidance.** No hard character limits in MVP, but a subtle
  word counter appears once the post is over 200 words ("250 words —
  consider keeping it concise").
- **Title auto-suggest.** For the generic composer, if the member has
  a URL, offer to use the URL's `<title>` as the post title.
- **Live preview.** A small "preview" toggle shows what the post will
  look like in the feed as composed. Reduces "wait what does this look
  like" anxiety.
- **Smart defaults visible.** Visibility, region, group — defaults are
  shown but easy to change. Members shouldn't have to _go looking_ for
  the override.

### At the post moment

Honest copy throughout:

- "Posting…" while the request is in flight
- "Posted. Here it is in the feed." once the post lands
- If dedup detection fires: the dedup interstitial (per BU-009) takes
  over with its own honest framing
- After successful post: "Want to share it onward?" with the platform
  picker right there — no 2-step

### When something goes wrong

- **Image fetch failed:** "Couldn't get an image from that URL —
  using a placeholder. You can change it later." Honest; doesn't block
  posting.
- **Network error:** "Couldn't reach the server. Your post is saved as
  a draft on this device. Try again?" Saves the work, offers retry.
- **Validation failure (rare):** "This post needs a body or a URL."
  Specific, fixable.

### When the member is unsure

A small ❓ icon next to the visibility dropdown:

> **Public:** Anyone with the link can read this post. Recommended for
> calls for action and content you want amplified.
>
> **Members only:** Only signed-in GPS Action members can read this.
> Recommended for internal coordination.
>
> **Private:** Only you and admins can read this. Use for sensitive
> reports.

Same pattern for region, group, post type. Help is on demand, not
forced.

---

## Worked example — the "share a link" 4-tap flow

Sharon sees a BBC video she wants to share. She copies the URL from
Safari.

**Step 1.** She opens the GPS Action PWA. _(Not a tap — just opening
the app.)_

**Step 2.** She taps the FAB. **(Tap 1)**

**Step 3.** The card overlay appears. The "🔗 Share a link" card is
highlighted with: _"Detected URL on clipboard — bbc.co.uk"_. She taps
it. **(Tap 2)**

**Step 4.** The composer opens. The URL field is pre-filled with the
BBC URL. The og:image, og:title, and og:description have been fetched
(took ~400ms; visible loading indicator while fetching). A preview card
shows below the URL.

The optional sentence field is focused. Sharon types: _"Worth a watch —
actually balanced for once"_. **(Typing — count as one effort)**

**Step 5.** She taps Post. **(Tap 3)**

**Step 6.** Loading: "Posting…" (~600ms).

**Step 7.** Confirmation: "Posted. Want to share it onward?" with the
share menu visible. She taps WhatsApp. **(Tap 4)**

**Total: 4 taps from app-open to "now sharing onward."**

This is comparable to WhatsApp's native flow. The "share a link" intent
card is the most important UX optimisation in the product.

---

## Worked example — "I'm not sure"

Sharon wants to share something but isn't sure what kind of post it is.
She has no URL — just an observation she wants to share with the
network.

**Step 1.** Opens app. Taps FAB. **(Tap 1)**

**Step 2.** Card overlay. She taps "🤔 I'm not sure". **(Tap 2)**

**Step 3.** Generic composer opens. The post-type picker is at the top.
She reads the options:

- Share a link — no, she has no link
- Call for action — no, this isn't urgent
- Boost — no, nothing to boost
- Event — no, not an event
- General — yes, this fits

She taps "General". **(Tap 3)**

**Step 4.** Composer adapts: body field is now primary. She types her
thoughts. **(Typing)**

**Step 5.** She picks visibility: members_only (default for this type).
She leaves region as national. She doesn't tag a group.

**Step 6.** She taps Post. **(Tap 4)**

**Total: 4 taps + reading + typing.** Slightly more than the share-a-link
flow because she had to make decisions, but no faster path is available
for the unsure case.

The "I'm not sure" card is the right escape hatch — it lets her think
through her options inside the composer rather than guessing wrong on
the cards.

---

## Schema additions for ERD Slice 2

The post-creation flow doesn't add many schema fields beyond what's
already specified — most of it is composer behaviour, not data. But:

### `Post.intentCard`

Tracks which FAB card the post was created from. Analytics value: are
the cards being used as expected? Are members frequently picking "I'm
not sure" (suggesting cards are mis-named)? Per-card adoption tells us
which cards work.

```prisma
enum PostIntentCard {
  share_link
  call_for_action
  boost
  event
  general
  unsure       // came in via "I'm not sure" → generic composer
}

model Post {
  // ... existing fields ...

  intentCard      PostIntentCard @default(unsure)

  // ... existing fields ...
}
```

### `Post.postType`

The actual post type (different from intentCard — intentCard is the
_entry point_, postType is the _result_). Most cards map 1:1, but the
"I'm not sure" / generic composer can produce any type:

```prisma
enum PostType {
  share_link        // from card 1
  call_for_action   // from card 2
  boost             // from card 3
  event             // from card 4
  general           // from card 5
  outcome           // from "I'm not sure" → outcome
  incident_report   // from "I'm not sure" → incident
}

model Post {
  // ... existing fields ...

  postType        PostType

  // ... existing fields ...
}
```

The decision in the composer maps the chosen card → post type. The
generic composer's dropdown sets postType directly.

### `Post.composerVersion`

Tracks the composer version used. Useful when iterating on composer
designs. Enables A/B testing later if we add it.

```prisma
model Post {
  // ... existing fields ...

  composerVersion String         @default("v1")

  // ... existing fields ...
}
```

---

## tRPC procedures

Composer-related procedures (some shared with sharing/dedup):

| Procedure               | Purpose                                                     | Auth   |
| ----------------------- | ----------------------------------------------------------- | ------ |
| `post.fetchUrlMetadata` | Server fetches og:title, og:description, og:image for a URL | member |
| `post.publish`          | Create a new post (handles dedup, image processing, etc.)   | member |
| `post.saveDraft`        | Save a draft (for resume-later)                             | member |
| `post.listMyDrafts`     | Member's saved drafts                                       | member |
| `post.discardDraft`     | Delete a draft                                              | member |
| `post.previewAs`        | Render the post-as-it-would-appear (for live preview)       | member |

`post.publish` is the heavy one — it:

1. Validates input (Zod schema, per api-contract-discipline.md)
2. Fetches and processes hero image if URL provided
3. Runs dedup check (per BU-009)
4. If duplicate, returns the dedup interstitial state
5. If unique, creates the post
6. Generates short ID
7. Schedules og:image generation (Tier 2, async)
8. Emits analytics events
9. Returns the post for the client to display

---

## Member-facing UI sketches (text)

### FAB card overlay (mobile)

```
╭───────────────────────────╮
│                           │
│   What kind of post?      │
│                           │
│   ╔═══════════════════╗   │  ← highlighted (clipboard URL detected)
│   ║ 🔗 Share a link   ║   │
│   ║ bbc.co.uk         ║   │
│   ╚═══════════════════╝   │
│                           │
│   ┌───────────────────┐   │
│   │ 📢 Call for       │   │
│   │    action now     │   │
│   └───────────────────┘   │
│                           │
│   ┌───────────────────┐   │
│   │ ✊ Boost          │   │
│   └───────────────────┘   │
│                           │
│   ┌───────────────────┐   │
│   │ 📅 Tell us about  │   │
│   │    an event       │   │
│   └───────────────────┘   │
│                           │
│   ┌───────────────────┐   │
│   │ ✏️ Just write     │   │
│   │    something      │   │
│   └───────────────────┘   │
│                           │
│   ┌───────────────────┐   │
│   │ 🤔 I'm not sure   │   │
│   └───────────────────┘   │
│                           │
│   [Cancel]                │
╰───────────────────────────╯
```

Cards are tappable, full-width, clear hierarchy. The detected-URL card
gets visual emphasis but doesn't dominate.

### "Share a link" composer (mobile, post-tap)

```
╭───────────────────────────╮
│ ←  Share a link        ✕ │
├───────────────────────────┤
│                           │
│ URL                       │
│ ┌───────────────────────┐ │
│ │ bbc.co.uk/iplayer/... │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │ [og:image preview]    │ │
│ │ Question Time         │ │
│ │ BBC iPlayer           │ │
│ └───────────────────────┘ │
│                           │
│ Add a thought (optional)  │
│ ┌───────────────────────┐ │
│ │ Worth a watch—balanced│ │
│ └───────────────────────┘ │
│                           │
│ Visibility: Public ▾      │
│ Relevant to: (none) ▾     │
│                           │
│ ┌───────────────────────┐ │
│ │      Post             │ │
│ └───────────────────────┘ │
│                           │
╰───────────────────────────╯
```

Minimal. Defaults are visible but unobtrusive. Post button is large
and unambiguous.

### Generic composer (after "I'm not sure")

```
╭───────────────────────────╮
│ ←  New post            ✕ │
├───────────────────────────┤
│                           │
│ Post type                 │
│ ┌───────────────────────┐ │
│ │ Pick one...        ▾  │ │
│ └───────────────────────┘ │
│                           │
│ Title (optional)          │
│ [                       ] │
│                           │
│ Body                      │
│ ┌───────────────────────┐ │
│ │                       │ │
│ │                       │ │
│ │                       │ │
│ └───────────────────────┘ │
│                           │
│ URL (optional)            │
│ [                       ] │
│                           │
│ Image                     │
│ Add image ▾               │
│                           │
│ Visibility ▾              │
│ Region ▾                  │
│ Relevant to ▾             │
│                           │
│ ┌───────────────────────┐ │
│ │  Post (pick type ↑)   │ │
│ └───────────────────────┘ │
│                           │
╰───────────────────────────╯
```

Post button shows the requirement gate ("pick type") so the member
knows what's blocking.

---

## Drafts

Members can save a post as a draft and resume later.

### When drafts auto-save

- Every 10 seconds after the member starts typing
- On composer exit (back button, app backgrounded)
- On explicit "Save draft" tap

### When drafts are listed

In the FAB overlay, if the member has any drafts, a small section appears:

```
╭───────────────────────────╮
│   What kind of post?      │
│                           │
│   [...cards...]           │
│                           │
│   ───────────────         │
│                           │
│   📝 Drafts (2)           │
│   • "Worth a watch..."    │
│   • "BBC just had a..."   │
│                           │
│   [Cancel]                │
╰───────────────────────────╯
```

Tap a draft → opens the composer with the saved state.

### Draft lifetime

- Drafts kept for 30 days by default
- Discarded automatically after 30 days of no activity
- Member can manually discard from the list
- Drafts are device-local for MVP (synced to server in Phase 2)

### Schema

```prisma
model PostDraft {
  id              String           @id @default(uuid())
  userId          String
  user            User             @relation("postDrafts", fields: [userId], references: [id], onDelete: Cascade)

  // Composer state, serialized
  intentCard      PostIntentCard?  // which card was chosen (if any)
  composerState   Json             // the form fields as last edited

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  expiresAt       DateTime         // = updatedAt + 30 days

  @@index([userId, expiresAt])
}
```

---

## Analytics events

These join the existing analytics catalogue (per `analytics-events.md`):

| Event                           | When                            | Properties                                                             |
| ------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| `composer_opened`               | FAB tapped, card overlay shown  | `had_clipboard_url` (bool)                                             |
| `composer_card_selected`        | Member tapped a card            | `card` (intentCard enum)                                               |
| `composer_url_metadata_fetched` | URL og:metadata fetched         | `success` (bool), `latency_ms`                                         |
| `post_published_from_composer`  | Post created via composer       | `card`, `postType`, `had_url`, `had_image`, `time_in_composer_seconds` |
| `composer_abandoned`            | Composer closed without posting | `card`, `time_in_composer_seconds`, `had_content` (bool)               |
| `draft_saved`                   | Draft created or updated        | `card`                                                                 |
| `draft_resumed`                 | Draft re-opened                 | `draft_age_hours`                                                      |

These feed an "Author experience" dashboard — are members posting easily?
Where do they drop off in the composer?

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **Composer for editing existing posts.** Edit flow is similar but not
   identical (no card selection, just editing the existing fields).
   Specified per Build Unit when edit lands.
2. **Comment composer.** Lighter-weight than post composer; specified in
   the comments Build Unit (BU-007).
3. **Voice / dictation input.** Could be useful (especially for older
   members). Phase 2.
4. **Multimedia composer.** Multiple images, video, polls. Phase 2 / 3.
5. **Composer keyboard shortcuts.** Power-user niceties for desktop.
   Phase 2.
6. **Mention/tag autocomplete.** Member typing @ and getting a member
   list. Phase 2.
7. **Markdown / rich text in body.** MVP body is plain text with auto-
   linkified URLs. Markdown is Phase 2.
8. **Post templates.** Pre-shaped starter posts ("BDS motion alert
   template"). Parking lot already has this; it would build on the
   intent-card model.
9. **Scheduled posting.** "Post this at 9am tomorrow." Parking lot.
10. **Cross-posting (post to multiple regions/groups simultaneously).**
    Already supported by the multi-tag fields; UI is a power-user concern.

---

## What lands in MVP

**MVP day 1:**

- FAB cards overlay with all 6 cards
- Each card opens a purpose-shaped composer
- Clipboard URL detection → highlight share-a-link card
- Auto-fetch og:metadata for URLs in composer
- Smart defaults (visibility, region, group) per card
- Live preview toggle
- Post-publish → share menu integration (per share-out-mechanics.md)
- Analytics events listed above
- Drafts: device-local, 30-day expiry

**Phase 1.5:**

- Drafts synced to server (cross-device)
- Image bank picker (per image-handling.md)
- Title auto-suggest from URL
- "First-time poster" onboarding tip

**Phase 2:**

- Edit post flow
- Mention autocomplete
- Markdown / rich text
- Scheduled posting
- Voice input
- Composer keyboard shortcuts

**Phase 3:**

- Multimedia composer
- Post templates
- AI-assisted writing (per existing parking-lot mention)
