# Inbound sharing

**Purpose:** The paths by which content from outside GPS Action gets _into_ GPS
Action as a draft post. "Sharon saw something on X and wants to post it to GPS
Action" — all the ways that can happen on the platforms we support.

**Status:** ABSORBING into feature spec v0.6. Will become §3.32.
**Build Unit:** BU-010 (Inbound sharing) — to be created.
**Related:** D003 (PWA-first stack), design-philosophy principle 1 (one-click
is king), dedup-and-cosurfacing.md (BU-009), engineering-roadmap.md (B11 for
future native iOS).

---

## The design stance (Path A)

**PWA-first for MVP.** We accept that iOS cannot expose GPS Action in the
native share sheet — Apple doesn't permit PWAs to register as share targets.
We mitigate with clipboard detection. We do what we can on Android. We build
the server-side `/share` endpoint from day one so native integration (Phase 2)
plugs in without rebuild.

**Native iOS for share-sheet integration** becomes Tier B (B11) on the
engineering roadmap with a specific trigger (see below).

---

## The four inbound paths

| Path                   | Platform         | Taps from source             | Status in MVP    |
| ---------------------- | ---------------- | ---------------------------- | ---------------- |
| Web Share Target API   | Android PWA      | 2 (share → GPS Action)       | ✅ Ship          |
| Clipboard detection    | iOS PWA, desktop | 3 (copy → open app → accept) | ✅ Ship          |
| `/share?url=` endpoint | Any browser      | 2 (tap bookmarklet → submit) | ✅ Ship          |
| Native share extension | iOS + Android    | 2 (share → GPS Action)       | ❌ Phase 2 (B11) |

All four converge on the same downstream flow — the "new post from shared
source" composer. Only the entry point differs.

---

## Path 1 — Android Web Share Target API

### What it does

When GPS Action is installed as a PWA on Android (Chrome, Samsung Internet,
Edge), it registers in the Android OS share sheet. Users long-press a post in
X, Instagram, or any other Android app, tap **Share**, and see **GPS Action**
in the list alongside other installed apps.

### How it works

The PWA manifest declares share target capabilities:

```json
{
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "image",
          "accept": ["image/jpeg", "image/png", "image/webp"]
        }
      ]
    }
  }
}
```

When the user shares, Android POSTs to `/share` with form-encoded data. Our
handler parses and routes to the composer with fields pre-populated.

### User flow

1. Sharon long-presses an X post on her Android phone
2. Taps **Share**
3. Taps **GPS Action** in the share sheet
4. GPS Action opens with the composer pre-populated (URL + any included text)
5. She reviews, edits if needed, taps **Post**

### Constraints

- **Requires PWA installation.** Users who only visit GPS Action in the
  browser don't get this. Installation prompt is part of onboarding.
- **Works only on Android.** iOS ignores `share_target` in the manifest.
- **Some Android browsers still don't support it.** Firefox Android is
  inconsistent; Samsung Internet and Chrome are reliable.

---

## Path 2 — Clipboard detection (iOS + desktop fallback)

### What it does

When a user opens GPS Action's composer and their clipboard contains a URL,
the composer offers: _"Post this URL from your clipboard? [bbc.co.uk/...]"_ —
one-tap to accept, URL pre-populated.

### User flow (iOS)

1. Sharon sees a post on X in the iOS app
2. Long-presses the post, taps **Copy Link**
3. Switches to GPS Action (home screen icon if installed as PWA, otherwise
   Safari)
4. Taps **+ New post** on her GPS Action home
5. Composer shows: _"Post this URL from your clipboard? [bbc.co.uk/...]"_
6. One tap to accept — URL pre-populated, composer ready
7. She submits

### Implementation notes

- **iOS permission prompt.** Safari's Clipboard API requires user gesture; the
  "read from clipboard" prompt shows on first use. Standard, expected UX.
- **Only offer if the clipboard contains a URL.** Simple regex check; don't
  suggest clipboard text that isn't a URL.
- **Show the detected URL** — never silently paste. Honesty matters (design
  philosophy principle 5).
- **Respect privacy.** If clipboard permission is declined, the composer works
  normally — just no suggestion. No nagging.
- **Dismissal state.** If the user dismisses the suggestion, don't re-offer
  the same URL in the same session.

### Desktop equivalent

Same pattern on desktop browsers — composer detects URL in clipboard, offers
the one-click accept. Works on Chrome, Edge, Safari, Firefox.

---

## Path 3 — `/share?url=...` endpoint + bookmarklet

### What it does

A server endpoint that accepts a URL and opens the composer with it
pre-populated. Enables three scenarios:

1. **Desktop bookmarklet.** Users save a bookmarklet in their browser's
   bookmark bar. On any page, they tap the bookmarklet and the page's URL is
   sent to GPS Action.
2. **Programmatic integrations.** Future integrations (a Chrome extension, a
   Slack command, an email auto-forwarder) all post to the same endpoint.
3. **Foundation for Phase 2 native.** When native iOS ships, the share
   extension posts to this same endpoint. No new backend work.

### The bookmarklet

```javascript
javascript: (function () {
  var u = encodeURIComponent(location.href);
  var t = encodeURIComponent(document.title);
  window.open('https://gps.action/share?url=' + u + '&title=' + t, '_blank');
})();
```

Users install it via a one-time setup page: _"Drag this button to your
bookmarks bar. Then tap it whenever you want to share a page to GPS Action."_

Clunky on mobile browsers. Useful on desktop, especially for power users
(journalists, coordinators who triage tweet storms from their laptop).

### Endpoint contract

```
GET /share?url={encoded}&title={encoded}&text={encoded}

Response: redirect to /compose?prefilled_url={encoded}&prefilled_title={encoded}
          — or, if not signed in: redirect to login with return-to preserved
```

Method is GET for bookmarklet simplicity. Sensitive data shouldn't be in query
strings — but a public URL + title aren't sensitive. No body content, no PII.

### Rate limiting

Endpoint is rate-limited per user (when signed in) and per IP (when not) —
10 requests per minute is fine. Prevents abuse of the bookmarklet as a
scraping vector.

---

## Path 4 — Native share extension (Phase 2)

**Not in MVP.** Documented here because it's the endgame.

When Phase 2 native apps ship (see engineering-roadmap B11), both iOS and
Android native apps register share extensions. The extensions receive the
shared content from the OS and POST it to the existing `/share` endpoint (or
a native equivalent API route). The composer opens; rest of the flow is
identical.

**Why this isn't in MVP:** Building and maintaining native iOS app extensions
for share sheet integration is material work (React Native share extensions
require native Swift code; app store review; provisioning profiles; push
plumbing) and the value is unverified. Path 2 (clipboard detection) captures
80% of the behavioural goal at <20% of the cost. Ship it, learn, then decide
if native is genuinely worth building.

---

## The downstream composer

All four paths converge here. When a URL arrives by any path, the composer:

1. Pre-populates the URL field
2. If Android Web Share Target passed a `title` or `text`, pre-populate those
   as the suggested body (user can edit)
3. Runs the **dedup check** (BU-009) — if the URL matches a post within the
   window, show the dedup interstitial
4. Otherwise render the normal composer, user finishes and submits

**This means Path 2 (clipboard) automatically inherits dedup behaviour** — no
special handling needed. The composer doesn't care where the URL came from.

---

## Data model additions

### `posts` table

- `inbound_source` (enum: `composer`, `clipboard`, `android_share`, `bookmarklet`, `share_endpoint`, `native_share` — for Phase 2)
- `inbound_metadata` (JSONB, nullable) — any extra fields passed by the source
  (e.g. Android share sheet sending an image binary, or bookmarklet sending
  page title)

Populated at post creation. Powers analytics (below) and debugging ("this post
arrived via clipboard detection at 14:03").

---

## Analytics events

Three new events; one is modification to an existing event.

### `share_intent_started`

**When:** Any inbound share path begins (share sheet tap, clipboard
suggestion shown, bookmarklet clicked, native extension opened).
**Properties:** `source` (enum matching `inbound_source` above), `platform`
**Fired from:** The entry-point handler for each path
**Build Unit:** BU-010
**Answers:** "How are people trying to get content in? Which paths are used?"

### `share_intent_completed`

**When:** The composer opens with pre-populated data from an inbound path.
**Properties:** `source`, `platform`, `had_url` (bool), `had_title` (bool),
`had_text` (bool)
**Fired from:** Composer mount when `inbound_source` is set
**Build Unit:** BU-010
**Answers:** "Do inbound paths complete successfully, or drop off mid-flow?"

### `share_intent_abandoned`

**When:** User opens the composer via a share path but never submits (leaves
or cancels before post).
**Properties:** `source`, `platform`, `time_in_composer_seconds`
**Fired from:** Composer unmount if no post was created in the session
**Build Unit:** BU-010
**Answers:** "Where does the funnel leak?"

### Modified: `post_published`

Add property `inbound_source` so every published post can be traced back to
how it arrived.

---

## Copy library additions

| Key                                    | Copy                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `share.clipboard.prompt`               | `Post this URL from your clipboard?`                                                                                                             |
| `share.clipboard.accept`               | `Use this URL`                                                                                                                                   |
| `share.clipboard.dismiss`              | `No thanks`                                                                                                                                      |
| `share.bookmarklet.setup.title`        | `Share to GPS Action from anywhere`                                                                                                              |
| `share.bookmarklet.setup.instructions` | `Drag this button to your bookmarks bar. Tap it on any page to share that page to GPS Action.`                                                   |
| `share.bookmarklet.button_label`       | `Share to GPS Action`                                                                                                                            |
| `share.bookmarklet.mobile_note`        | `On mobile? This works best on desktop. On your phone, copy the link and paste it into the GPS Action composer — we'll detect it automatically.` |
| `share.android.not_signed_in`          | `Sign in to GPS Action to share. We'll bring you right back to post.`                                                                            |
| `share.endpoint.loading`               | `Getting ready to share…`                                                                                                                        |
| `share.endpoint.error`                 | `Couldn't open that share. Paste the link into the composer instead.`                                                                            |

All follow design-philosophy voice rules: warm, honest, plain English, no
manufactured urgency.

---

## Onboarding implications

The onboarding flow (BU-002) gains two small additions for this feature:

1. **PWA install prompt on Android.** Show the browser's native install prompt
   near the end of onboarding — "Install GPS Action on your home screen to
   share from other apps." Skip on iOS (install prompt exists but share
   target won't work).
2. **Clipboard permission priming on iOS.** First time the composer is opened,
   a single info card: _"When you copy a link, we'll offer to post it here.
   Your clipboard stays private unless you choose to use what's in it."_

These are small copy additions, not big flows. Worth naming because they need
to land in onboarding PRs alongside the share work.

---

## Edge cases — thought through

### User shares something that isn't a URL (plain text, an image)

- **Android Web Share Target** can receive images — handle them as attachments
  in the composer (BU-003 supports post types with images)
- **Plain text without URL** — pre-populate the composer body; no URL field
  populated; user can still post as a text post
- **Clipboard detection** only triggers on URLs. Other clipboard contents are
  ignored (no false suggestions)

### User shares from an app that passes garbage URLs

Tracking-laden URLs arrive (`?utm_source=x&fbclid=...&ref=...`). URL
normalisation (from dedup spec) strips these. The clean URL is what gets
stored and displayed. The dedup check runs on the normalised URL.

### User shares the same URL twice within the window

Dedup interstitial (BU-009) fires — same flow as composer-originated duplicates.

### User taps the bookmarklet while signed out

`/share` endpoint redirects to login with the intended share preserved as
query params in a return-to URL. After login, composer opens with
pre-populated URL. No data lost.

### Share arrives with a very long title or text

Truncate defensively at the handler: URL up to 2048 chars, title up to 200
chars, text up to 2000 chars. Anything longer is silently truncated (not
rejected — honest copy: warn the user in the composer if truncation happened).

### User's clipboard contains a private URL (e.g. Google Doc)

Not our problem to detect — if they paste it, they paste it. Worth a note in
the prompt: _"Only share URLs you mean to share publicly."_ — but don't
introduce false-positive private-URL detection, it would be unreliable and
annoying.

---

## What this spec does NOT cover

1. **Image-only shares through Web Share Target API.** The manifest declares
   image file support, but the UI for "post as an image post with optional
   caption" is a composer concern (BU-003). Calling it out here so it's not
   forgotten at integration time.
2. **Email-based sharing.** "Forward to post@gps.action to create a post" is
   a nice idea, Phase 3 at earliest. Needs inbound email parsing, auth via
   email-from matching, spam filtering. Not in scope.
3. **Browser extensions.** A Chrome/Firefox extension with a dedicated button
   would be a Path 5. Post-MVP. Uses the same `/share` endpoint.
4. **Deep links from other apps.** If another Jewish-community app wanted to
   send content to GPS Action via URL scheme, that's Path 6. Post-MVP.
5. **Cross-device handoff.** Starting a share on phone and completing on
   desktop. iCloud Universal Clipboard kinda does this already; we don't
   build it.
6. **Success rate measurement by platform.** The analytics events above
   support this but the dashboards aren't specified here.

---

## Implementation sketch for Claude Code

When BU-010 is briefed:

1. **PWA manifest update** — add `share_target` block. Test on Android device.
2. **`/share` endpoint** — Next.js route handler accepting GET (bookmarklet) and
   POST (Android Web Share Target). Validates input, redirects to composer.
3. **Composer pre-population** — accept `prefilled_url`, `prefilled_title`,
   `prefilled_text` query params. Populate fields. Show origin banner
   ("Posting from X" with a subtle dismiss).
4. **Clipboard detection** — on composer mount, try `navigator.clipboard.readText()`
   inside a try/catch. If it returns a valid URL that matches no previously-dismissed
   URL in this session, show the suggestion card.
5. **Bookmarklet setup page** — static page at `/bookmarklet` with the drag-to-install
   button and platform-specific copy.
6. **Rate limiting** — simple in-memory or Redis-backed rate limiter on `/share`.
7. **Analytics wiring** — three new events + `inbound_source` on `post_published`.
8. **Onboarding copy** — PWA install prompt trigger + clipboard permission primer
   (copy library keys above).
9. **Integration tests** — Android Web Share Target (via synthetic POST),
   clipboard flow (via mocked clipboard API), bookmarklet flow, sign-in
   redirect preservation.

**Estimated sessions:** 3–4 Claude Code sessions. Clipboard detection is the
trickiest — browser compatibility matrix, permission handling, dismiss-state
tracking.

**Depends on:** BU-003 (composer), BU-002 (auth/onboarding — for sign-in
redirect). Ideally BU-009 (dedup) is shipped first so dedup check is inherited
for free.

**Blocks:** Nothing critical. Like BU-009, this is a quality-of-life feature.
Can ship mid-build. Strong candidate for an early vertical slice because the
scenarios ("Sharon sees something on X and posts it to GPS Action") are
exactly the ones that make the product real.
