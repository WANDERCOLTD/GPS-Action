# Design philosophy

**Purpose:** What every design decision serves. When rules conflict, the order
below is the tiebreaker. This is the source of truth for _feel_ — voice,
interaction, pacing, weight. Specific colours, typography, spacing live in
`styles/tokens.css`; specific phrases in the copy library; this document says
what we're optimising for and why.

**Audience:** Anyone making design choices, including Claude Code sessions
writing UI. CLAUDE.md points here for any UI work.

---

## The five principles, in priority order

### 1. One-click is king

**Every meaningful member action is one tap from the post.**

Sharing, taking an action, reacting, flagging, replying — one tap. If a flow
has two taps, question it. If it has three, redesign it. Long-press for
secondary options is fine; primary actions are always a single visible tap.

**Why this matters:** WhatsApp makes every GPS action feel like work — copy the
message, paste it elsewhere, tell someone where to go. We don't. That
friction-removal is the product's main competitive advantage over the tool
everyone is already using. Lose it and the product has no reason to exist.

**In practice:**

- 1-click share — destination picker is the tap; no "are you sure" modal.
- 1-click action — action CTA completes the action (with 5-second undo visible).
- 1-click react — emoji tray appears on the post, tap to react.
- Dispatch is one modal, not a wizard.
- Vetting approve / reject is two buttons, not a form. Reason is required only
  for reject, and defaults to the most common reason so most rejects are still
  one tap.

**The exception that proves the rule:** destructive or irreversible actions
(delete my account, ban a user) require two taps. See principle 5 on the tension.

### 2. Sharon-warmth

**The product has a voice. It's warm, casual, respectful of intelligence.**

It sounds like Sharon — welcoming without fawning, direct without being curt,
occasionally funny, never corporate. It's a person, not a platform.

**Examples:**

| Context              | ✅ Sharon                                     | ❌ Corporate                                         |
| -------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Home on return       | "Welcome back 💕 New in your regions."        | "Hello User. You have 3 unread notifications."       |
| First post           | "You did it. First post is up."               | "Post successfully submitted."                       |
| Empty state          | "Quiet in here. Anything worth posting?"      | "No posts to display."                               |
| Admin confirming ban | "Ban Julia? This blocks her from all of GPS." | "Are you sure you want to proceed with this action?" |

**Emoji policy:**

- ✅ Fine in community-facing copy, welcome messages, reactions (💕🤗🙏)
- ❌ Not in error messages, admin screens, safety warnings, anything legal
- ❌ Not in notifications (they look spammy and trigger filters)
- ❌ Never in system-generated content attributed to a member

**The line to hold:** warmth is not infantilising. Members are adults doing
serious work. Copy can be warm without being cutesy.

### 3. No anxiety amplification

**This product helps members respond to a genuine threat. The last thing they
need is manufactured urgency.**

We do **not** use:

- Infinite scroll (the feed has an end and members can reach it)
- Red-dot badges for non-urgent counts (only for genuinely new, time-sensitive items)
- "You're missing out" / "Don't forget" framing
- Auto-playing video or audio
- Notification spam ("5 people liked your post!" × 5 separate pings)
- Fake activity indicators ("12 people are looking at this post right now")
- Dark patterns — every CTA has an equally-weighted decline path
- Session-ending upsells or "just one more thing before you go"

We **do** provide:

- Clear "You're all caught up" states at the end of feeds
- Quiet hours (no notifications 22:00 – 07:00 local, default on, user-overrideable)
- Notification bundling (one digest, not one per event)
- Permission to close the app — the UI actively supports stopping

**The aspiration:** a good session ends with "I did something useful and now
I'm going to make dinner." Not "I couldn't stop scrolling."

### 4. Cultural dignity

**Sacred and urgent need different visual language. Both deserve their own voice.**

GPS Action posts cover a spectrum from urgent tactical action ("Stop this event
on Saturday") to cultural and spiritual moments (Shabbat greetings, yahrzeit,
remembrance). These are not the same kind of post and must not look the same.

**Urgent action posts** — accent colour, strong typography, clear CTAs,
timestamp visibility.

**Cultural / remembrance posts** — bordeaux marker (`#6B3045`), quieter
typography, muted urgency, no action CTAs unless explicitly relevant. They
are read, held, perhaps reacted to — rarely "actioned" in the tactical sense.

**Specific rules:**

- A Shabbat candle-lighting post does not display "time until dispatch" pills.
- A yahrzeit post uses the bordeaux marker and softer type.
- The 14-emoji reaction set includes 🕯️ ✡️ 🙏 specifically for these moments.
- Seasonal reactions (🕎 🍎 🌿) appear only in their relevant windows.

**Why it matters:** treating every post with the same urgent styling flattens
meaning and disrespects the cultural moments. Members notice.

### 5. Honest copy

**Say what is true. Say what will happen. Don't dress things up.**

The product is trusted to route information that matters. It cannot overstate
its own behaviour or pretend it did things it didn't do.

**The tension with principle 1** — sometimes being honest requires a moment
of friction that a 1-click ideal would eliminate. When they conflict, honesty
wins for destructive or irreversible actions; 1-click wins for additive ones.

**Examples:**

| ✅ Honest                                                          | ❌ Dressed up                             |
| ------------------------------------------------------------------ | ----------------------------------------- |
| "Opening your mail client…"                                        | "We've sent your email!"                  |
| "Sending to WhatsApp — tap paste when it opens"                    | "Dispatched! 🎉"                          |
| "Your post is with moderators. Usually reviewed within 24 hours."  | "Your post is live!" (if it's not)        |
| "Failed to reach our server. Check your connection."               | "Something went wrong. Please try again." |
| "We'll email you when approved. Check spam too."                   | "Approval pending."                       |
| "Ban Julia? She won't be able to post or comment. She can appeal." | "Confirm ban?"                            |

**Plain English throughout:**

| Use                 | Not                                                  |
| ------------------- | ---------------------------------------------------- |
| Send                | Dispatch (user-facing) / Syndicate / Broadcast       |
| Share               | Amplify / Propagate                                  |
| Delete              | Terminate / Remove permanently                       |
| Approve             | Authorise / Validate / Ratify                        |
| Post                | Publication / Item / Entry                           |
| Steward _(testing)_ | Coordinator (pending user research, see parking lot) |

**Note:** data model terms can be technical (`verdict: boost`, `dispatch_state: queued`
are fine in code and logs). Only user-visible copy follows the plain-English rule.

---

## When principles conflict

**One-click vs Honest copy.** Publishing without a confirmation step is 1-click
but might let a user publish something they didn't intend.

_Resolution:_ the **action** is one tap; the **undo** is visible for 5 seconds
after. "Posted — undo" is both 1-click and honest. The user can change their
mind without a dialog getting in the way.

**No anxiety vs Urgency.** Some posts genuinely are urgent. How do we flag them
without using the same patterns we've banned?

_Resolution:_ urgency is in the **content**, not in **site chrome**. An urgent
post has an urgency marker in its card (small, clear, not flashing). The app
itself does not flash, pulse, or shout. Members bring urgency from reading;
we don't manufacture it with UI.

**Sharon-warmth vs Cultural dignity.** Shabbat and remembrance posts need
quieter voice; the rest of the product is warm and casual.

_Resolution:_ voice matches the post's moment. The system copy around a
cultural post is quieter. The comment composer on a yahrzeit post says
"Leave a thought" not "Got something to say? 💕". Voice is context-aware.

**One-click vs Cultural dignity.** Destructive actions on culturally-weighted
content (deleting a yahrzeit post) deserve extra pause.

_Resolution:_ delete on a cultural-marker post uses a two-step confirm with
a longer message. Rare case, worth the friction.

---

## Glyph register (icon re-use)

`lucide-react` is the project-wide icon family. This register is the single
source of truth for picks across the app. **Re-use before introducing.** When a
BU ships a new glyph, update this register in the same commit.

### AppNav tabs (BU-icon-nav, shipped #152)

| Tab      | Glyph            |
| -------- | ---------------- |
| Feed     | `home`           |
| Calendar | `calendar-clock` |
| Requests | `inbox`          |
| Data     | `bar-chart-3`    |
| Settings | `settings`       |

### In-content glyphs (shipped)

| Concept                     | Glyph                     | Component(s)                                                              |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| Comment count               | `message-square`          | `PostCard`, `CommentList` (Discussion tab — BU-icon-strips re-use)        |
| Event time                  | `calendar`                | `PostCard`, `NearMeView` (Date sort — BU-icon-strips re-use)              |
| Event kind / Events filter  | `calendar-days`           | `KindPickerSheet`, `FeedFilterChips` (Events chip — BU-icon-strips)       |
| Location                    | `map-pin`                 | `PostCard`                                                                |
| External link               | `external-link`           | `LinkPreviewCard`                                                         |
| In-app refresh              | `refresh-cw` / `loader-2` | `HeaderRefreshButton`                                                     |
| Modal/sheet dismiss         | `x`                       | `IntentFabSheet`, `PostPublishModal`                                      |
| FAB primary                 | `plus`                    | `IntentFab`                                                               |
| Clipboard paste             | `clipboard-paste`         | `IntentFab`, `IntentFabSheet`                                             |
| Send / publish              | `send`                    | `PostPublishModal`                                                        |
| Save as draft / edit        | `file-edit`               | `PostPublishModal`                                                        |
| Reviewer queue inbox        | `inbox`                   | `PostPublishModal` (same glyph as Requests tab — both = "incoming queue") |
| Dev banner toggle           | `eye` / `eye-off`         | `DevBannerToggle`                                                         |
| Filter chip — Urgent        | `zap`                     | `FeedFilterChips` (BU-icon-strips)                                        |
| Filter chip — Happening now | `radio`                   | `FeedFilterChips` (BU-icon-strips)                                        |
| Filter chip — Meetings      | `users`                   | `FeedFilterChips` (BU-icon-strips)                                        |
| Comments tab — Activity     | `activity`                | `CommentList` (BU-icon-strips)                                            |
| Sort affordance — Distance  | `ruler-dimension-line`    | `NearMeView` (BU-icon-strips — map-scale-bar look)                        |

### Person vs group (the `user` / `users` carve)

Lucide ships both `user` (single silhouette) and `users` (group). Per
Rule 2 these are kept as distinct concepts and **must not be swapped**:

| Concept                          | Glyph   |
| -------------------------------- | ------- |
| Person — singular, an individual | `user`  |
| Group — plural, multiple people  | `users` |

### Exceptions (deliberate non-lucide glyphs)

A handful of chip slots use non-lucide visuals on purpose. New
exceptions require a one-line rationale below.

| Concept                       | Glyph                                          | Why exception                                                                                               |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Filter chip — Activist Mailer | brand `<img>` (`/brands/activist-mailer.webp`) | Partner-brand identity (per share-taxonomy). `FeedFilterChips`.                                             |
| Filter chip — Tick-or-cross   | `✅❌` emoji                                   | The chip's identity _is_ the literal yes/no pair; no single lucide line icon mirrors it. `FeedFilterChips`. |

### Reservations

Glyphs reserved for a specific concept and **not to be used elsewhere**,
even if conceptually adjacent.

| Glyph       | Reserved for                                                    | Notes                                                                   |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `megaphone` | Activist Mailer (lucide fallback if the brand glyph ever swaps) | Don't burn it on rallies / events / amplification UI on other surfaces. |

### Primitives

Cross-cutting components that wrap glyphs but don't introduce one of
their own.

| Primitive         | Purpose                                                                                                                                | Component             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `IconChipTooltip` | Long-press / hover label for icon-only chips and nav links. Adopted by AppNav, FeedFilterChips, CommentList, NearMeView (sort toggle). | `IconChipTooltip.tsx` |

### Locked, not yet shipped (BU-search-surface)

| Concept                                | Glyph            | New / Re-use         |
| -------------------------------------- | ---------------- | -------------------- |
| Search trigger (AppNav header)         | `search`         | New                  |
| Overlay header back                    | `chevron-left`   | New                  |
| Posts group label (optional)           | `message-square` | Re-use (PostCard)    |
| Regions group label (optional)         | `map-pin`        | Re-use (PostCard)    |
| People group label (optional)          | `user`           | New                  |
| Partner orgs group label (optional)    | `building-2`     | New (gated on §3.30) |
| Recently-viewed item marker (optional) | `clock`          | New                  |

### Rules

1. **Re-use before introducing.** Search this register before picking. If the
   concept already has a glyph, use it.
2. **One concept, one glyph.** "Person" → `user` everywhere. Don't ship
   `user-circle` for the same concept on a different surface.
3. **Match `strokeWidth` and size to `AppNav`.** Visual weight uniform across
   surfaces; no oversized icons in body content.
4. **Update this register in the same commit that ships a new glyph.** A BU
   that introduces a new icon without updating the register is incomplete.

---

## What this document is NOT

- **Not a style guide for tokens.** Colours, typography, spacing — `styles/tokens.css`. (Glyph register above is the exception — kept here so it's read before any UI work.)
- **Not a copy library.** Specific blessed phrases — `docs/product/copy-library.md` _(to be written)_.
- **Not component guidance.** Reusable primitives — Storybook.
- **Not an accessibility reference.** WCAG 2.2 AA rules — `docs/process/accessibility-guide.md` _(to be written)_.

This document is the **philosophy**. Everything above is why; everything in the
other docs is how.

---

## Checklist for UI reviewers

When reviewing a UI PR, the questions are:

- [ ] Are primary actions single-tap?
- [ ] Does the copy sound like a person, not a corporation?
- [ ] Does any UI element manufacture urgency that isn't in the content?
- [ ] Are cultural/remembrance contexts handled with appropriate visual weight?
- [ ] Is every claim in the copy actually true of what the code does?
- [ ] For destructive actions — is the undo / confirmation proportionate?

These questions go in the reviewer checklist for UI-touching PRs.
