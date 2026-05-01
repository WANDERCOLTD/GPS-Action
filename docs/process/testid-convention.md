# `data-testid` convention

_The naming standard for stable test selectors on interactive UI._

_Version: 0.1 · April 2026_
_Enforced by: `eslint-rules/rules/require-testid.js` (F14)_
_Canonical area list lives at: `eslint-rules/canonical-areas.json`_

---

## Why this exists

Tests, scenario walk-throughs, and any future automated scenario runner
need to find elements in the DOM reliably. CSS classes change when styles
are refactored. Element text changes when copy is revised or translated.
Element structure changes when a designer reorders a layout. None of these
should break a test.

`data-testid` is a deliberate, stable handle that says: this element exists
to be addressable. The attribute survives style refactors, copy edits,
i18n, and DOM reshuffling — because it has nothing to do with appearance.

The discipline is mechanical: every interactive element gets a
well-formed `data-testid`. The ESLint rule fails any PR that violates
this. No exceptions for "I'll add it later."

## The format

```
data-testid="<area>-<element>-<variant>"
```

Three or more segments. All lowercase. Hyphen-separated. No camelCase,
no underscores, no spaces.

| Segment     | Required | Purpose                                              |
| ----------- | -------- | ---------------------------------------------------- |
| `<area>`    | Yes      | The product surface or feature area                  |
| `<element>` | Yes      | What kind of thing this is (button, form, card, ...) |
| `<variant>` | Optional | Disambiguates instances within the same area         |

You can have more than three segments. Two-segment IDs (`feed-button`)
are rejected — too generic to be stable.

### Canonical area prefixes

The first segment must come from this approved list:

| Prefix         | Surface                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `auth`         | Login, dev-login, account recovery                                                                              |
| `feed`         | The main feed page and its post cards                                                                           |
| `compose`      | The post composer (BU-composer; later FAB cards)                                                                |
| `post`         | Post detail page and post-related components                                                                    |
| `nav`          | Bottom tabs, sidebars, top-level navigation                                                                     |
| `admin`        | Admin surfaces (queues, role grants, content mod)                                                               |
| `network`      | Network tab — coordinator/group directory (D030)                                                                |
| `inbox`        | Inbox tab — DMs, notifications, requests (D030)                                                                 |
| `me`           | Me tab — profile, settings, account (D030)                                                                      |
| `reaction`     | Reaction pill + tray on post cards (BU-reactions)                                                               |
| `comment`      | Comment thread + composer on post detail (BU-comments)                                                          |
| `link`         | Link preview cards on post cards + detail (BU-link-share — D060)                                                |
| `requests`     | Requests workspace — submitter list, reviewer queue, claim/resolve (BU-requests-foundation, BU-requests-urgent) |
| `alert`        | Urgent alert composer + FAB tile (BU-requests-urgent — D058)                                                    |
| `data`         | Data inspector — entity index + per-entity pages (BU-requests-foundation, BU-admin-crud)                        |
| `settings`     | Settings landing + admin sections (BU-requests-foundation, future BUs)                                          |
| `intent`       | FAB intent picker — single FAB + tile grid (BU-fab-intent-picker — D044, D062)                                  |
| `capabilities` | SRS capabilities mockup at `/capabilities` — static showcase tiles (`app/capabilities/`)                        |
| `calendar`     | Calendar tab — agenda view, month grid, day panel (BU-calendar-view — D073)                                     |
| `dev`          | Dev-only affordances on the demo path — banner toggle, dev tools (BU-one-click-polish)                          |

To add a new area:

1. Update `eslint-rules/canonical-areas.json`
2. Update the table above
3. Land both changes in the same PR

The rule fails loudly on unknown prefixes. This forces the conversation
about new areas to happen consciously, not by accident.

### Why areas are NOT Build Unit IDs

This is deliberate. Build Units are work primitives — they get reordered,
split, merged, and renamed as planning evolves. Test selectors are a
stability surface — they shouldn't change when the planning paperwork
changes. The two concepts share the language of "what's this part of?"
but answer different questions:

- **Build Unit** answers: which planning unit shipped this?
- **Area prefix** answers: which user-facing surface does this belong to?

Areas are coarser than BUs and stay stable across BU reorganisation.

## Compliant examples

```jsx
<button data-testid="compose-newpost-submit">Publish</button>
<a data-testid="feed-post-card-am" href={post.activistMailerUrl}>Open in AM</a>

<form data-testid="compose-newpost-form">
  <input data-testid="compose-newpost-input-title" />
  <textarea data-testid="compose-newpost-input-body" />
  <input data-testid="compose-newpost-input-amurl" />
  <button data-testid="compose-newpost-submit">Publish</button>
  <button data-testid="compose-newpost-cancel">Cancel</button>
</form>

<a data-testid="feed-newpost-link" href="/compose">New post</a>

<button data-testid="auth-devlogin-switch-eddie">Log in as Eddie</button>
```

## Violating examples

```jsx
// Missing — interactive element with no testid
<button>Publish</button>

// camelCase — banned
<button data-testid="composeNewpostSubmit">Publish</button>

// Underscores — banned
<button data-testid="compose_newpost_submit">Publish</button>

// Two segments — too generic to be stable
<button data-testid="compose-button">Publish</button>

// Unknown area — must be added to canonical-areas.json first
<button data-testid="widgets-newpost-submit">Publish</button>

// Dynamic interpolation — must be a static string
<article data-testid={`feed-post-card-${post.id}`}>...</article>

// Common typo — `data-testid`, not `testid` or `data-test-id`
<button testid="compose-newpost-submit">Publish</button>
```

## Dynamic identities

When the same element repeats — post cards in a feed, councillor rows in
a list, tabs in a tab strip — the `data-testid` stays constant and the
unique identity goes in a separate `data-*` attribute:

```jsx
// Correct — stable testid, separate id attribute
<article data-testid="feed-post-card" data-post-id={post.id}>
  <h3 data-testid="feed-post-card-title">{post.title}</h3>
  <a data-testid="feed-post-card-am" href={post.amUrl}>
    Open in AM
  </a>
</article>
```

```jsx
// Wrong — id embedded in testid; the rule fires `notStatic`
<article data-testid={`feed-post-card-${post.id}`}>...</article>
```

This pattern lets a test or scenario runner select all cards
(`getByTestId('feed-post-card')`) or a specific one
(`...filter({ has: page.locator('[data-post-id="42"]') })`) without
reinventing the selector strategy.

## Custom React components are exempt

The rule applies at the leaf-DOM level. A custom React component like
`<PostForm />` does not need its own `data-testid` — the underlying
`<form data-testid="compose-newpost-form">` inside `PostForm.tsx`
carries the responsibility.

This means the rule fires on:

- `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`, `<form>`,
  `<label>` (built-in HTML interactive elements)
- Any element with `onClick`, `onChange`, `onSubmit`, `onKeyDown`,
  `onKeyUp`, `onKeyPress`, `onFocus`, `onBlur`

It does NOT fire on:

- Custom components: anything starting with an uppercase letter
- Non-interactive elements: `<div>`, `<section>`, `<p>`, etc., unless
  they have an interactive handler

If a custom component needs a testid for the wrapper itself (rare —
usually the inner element is what's addressable), apply it inside the
component definition.

## Page Object Model — recommended for tests

Tests and scenario walk-throughs should not use raw `data-testid`
strings. Wrap each page in a Page Object class that exposes its
testids as methods:

```ts
// pages/ComposePage.ts
export class ComposePage {
  constructor(private page: Page) {}

  form = () => this.page.getByTestId('compose-newpost-form');
  titleInput = () => this.page.getByTestId('compose-newpost-input-title');
  bodyInput = () => this.page.getByTestId('compose-newpost-input-body');
  amUrlInput = () => this.page.getByTestId('compose-newpost-input-amurl');
  submit = () => this.page.getByTestId('compose-newpost-submit');
  cancel = () => this.page.getByTestId('compose-newpost-cancel');
}
```

When a `data-testid` changes, exactly one file changes. No grep-and-
replace across step definitions or test files.

This is a recommendation, not a rule — Page Objects are not enforced by
F14. They become enforceable if/when an automated scenario runner is
adopted.

## What this convention is NOT

- It is **not** an accessibility solution. `aria-label`, `role`, and
  semantic HTML are separate concerns. A testid does not replace them.
- It is **not** a CSS hook. Don't style on `[data-testid="..."]`.
  Testids are for tests; classes (or design tokens) are for styles.
- It is **not** a contract for users. `data-testid` values are
  internal to the codebase — change them deliberately, but don't treat
  them as external API.

## Adding a new area prefix

1. Decide the area name — short, lowercase, no hyphens within it
2. Add it to the table above
3. Add it to `eslint-rules/canonical-areas.json` in the same PR
4. The rule picks it up on next lint run

Disagreements about whether a new area is justified should happen in
PR review. The rule's job is to make the conversation visible, not to
decide it.

## Anti-patterns

| Anti-pattern                                       | Why it fails                                          |
| -------------------------------------------------- | ----------------------------------------------------- |
| `data-testid="submit"`                             | No area — collides across the app                     |
| `data-testid="newPostButton"`                      | camelCase — not parseable as a multi-segment ID       |
| `data-testid={t('feed.newpost')}`                  | Bound to translated copy — breaks when locale changes |
| `data-testid="feed-post-card-blue-large"`          | Variants describing visual style                      |
| `<div className="feed-post" />` (no testid)        | Tests will rely on classes — they will break          |
| `data-testid={isAdmin ? 'admin-foo' : 'user-foo'}` | Conditional — splits a selector into two              |

## Cross-references

- ESLint rule: `eslint-rules/rules/require-testid.js`
- Canonical area list: `eslint-rules/canonical-areas.json`
- Session brief that established the rule:
  `docs/build/session-briefs/f14-require-testid.md`
- Sibling enforcement rules: F06 rule 1 (`require-build-unit-header`),
  F13 (`require-spec-tag`)
- Discipline philosophy: `docs/process/ratchet-discipline.md`
