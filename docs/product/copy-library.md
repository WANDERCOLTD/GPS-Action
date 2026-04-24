# Copy library — seed

**Purpose:** System-generated user-facing strings live here, keyed by ID so
Claude Code uses them consistently across the product. This file starts as a
seed with the dedup strings; grows as other features add theirs.

**Related:** `docs/product/design-philosophy.md` (voice and tone rules).

---

## How this works

Every system-generated string the user sees has a key. Components reference
the key, never hardcode the string. When a string changes, it changes here —
once — and every usage updates.

**Variable syntax:** `{variable_name}` — replaced at render time with actual
values. Keep variables simple: first names, counts, relative times. No complex
formatting logic.

**Voice rules** (from design-philosophy):

- Warm, not corporate (principle 2: Sharon-warmth)
- Honest about what happens (principle 5)
- Plain English (principle 5)
- No manufactured urgency (principle 3)
- Neutral pronouns where applicable ("their" not "his/her")

---

## Deduplication strings (BU-009)

| Key                                | Copy                                                                         | Notes                                         |
| ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `dedup.interstitial.headline`      | `{author_first_name} posted this {relative_time}`                            | Headline on the interstitial Abby sees        |
| `dedup.interstitial.reassurance`   | `Your thoughts will be added as a comment so we keep it all in one place.`   | Explains what happens                         |
| `dedup.interstitial.primary_cta`   | `Add my comment`                                                             | Default button                                |
| `dedup.interstitial.secondary_cta` | `Post separately instead`                                                    | Visible, not buried                           |
| `dedup.comment.default_framing`    | `{author_first_name} saw this too and wants to share.`                       | Pre-populated in the comment composer         |
| `dedup.comment.disclosure_label`   | `Include what you wrote?`                                                    | Collapsed disclosure; expands to show draft   |
| `dedup.notification.specific`      | `{commenter_first_name} saw this too and added their thoughts to your post.` | Sharon's notification — uses "their", neutral |
| `dedup.interstitial.self_authored` | `You posted this {relative_time}. Want to add a new comment instead?`        | Edge case: re-posting own URL within window   |

**Variables used here:**

- `{author_first_name}` — first name of the canonical post's author
- `{commenter_first_name}` — first name of the merged commenter (Abby in examples)
- `{relative_time}` — human-friendly: "2 hours ago," "yesterday," "earlier today"

---

## Future sections

As features add their own strings, they'll be added below as new sections.
Keep alphabetical by feature key to make lookup easy.

- `action.*` — (to be added when BU-006 ships)
- `comment.*` — (to be added when BU-007 ships)
- `dispatch.*` — (to be added when BU-011 ships)
- `flag.*` — (to be added when BU-012 ships)
- `notification.*` — (to be added as notifications are defined)
- `onboarding.*` — (to be added when BU-002 ships)
- `post.*` — (to be added when BU-003 ships)
- `reaction.*` — (to be added when BU-008 ships)
- `vetting.*` — (to be added when BU-004 ships)

---

## Rules for adding strings

1. **Every user-facing string is keyed here.** If it's not here, it doesn't
   ship. Reviewer checks this on UI PRs.
2. **Keys are dot-separated, feature-prefixed.** `dedup.interstitial.headline`
   not `headline_dedup_interstitial`.
3. **Variables are `{snake_case}`.** Consistent with what Claude Code tends to
   generate.
4. **No HTML in strings.** Styling is the component's job. Strings carry words
   only.
5. **One voice per context.** Cultural-marker contexts (bordeaux posts) use
   quieter copy variants — these get their own `.cultural` suffix on the key
   (e.g. `post.published.cultural`).
6. **Review any new string against the 5 design-philosophy principles before
   adding.** The reviewer checklist includes this.
7. **Deleted strings stay in the file, marked `DEPRECATED` with a date.** Don't
   silently remove keys — a build somewhere might still reference them. Remove
   during the "nothing new" week after all references are gone.
