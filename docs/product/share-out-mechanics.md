# Share-out mechanics

**Purpose:** Define how GPS Action members share their posts onward to
external platforms — WhatsApp, X (Twitter), Facebook, Instagram — with
honest acknowledgement of each platform's quirks, limitations, and the
friction they impose. Includes UI sketches and the friction-count
analysis that drove design choices.

**Status:** Architectural + product. Affects ERD Slice 2 (DispatchEvent
table) and the share Build Unit. Will become §3.37 of feature spec.

**Build Unit:** BU-013 (Share-out flows) — to be created.
**Related:** `dedup-and-cosurfacing.md` (dispatch indicator on posts),
`deep-linking-and-tracking.md` (URLs we share back; tracking),
`post-creation-flow.md` (compose → share is one continuous flow),
`design-philosophy.md` (one-click is king; honest copy when platforms
limit us).

---

## What outbound sharing actually is

When Sharon posts in GPS Action and wants others outside the platform to
see/act on it, she has three things to share:

1. **The original content** — the BBC video URL, the petition link, the
   tweet to amplify
2. **Her commentary** — her sentence about why it matters
3. **A link back to GPS Action** — the deep link to the post (per
   `deep-linking-and-tracking.md`)

Different platforms accept different combinations of these three. The
share-out flow exists to deliver them appropriately for each platform.

---

## The four platforms — honest reality check

| Platform | API quality | Friction | MVP status |
|---|---|---|---|
| **WhatsApp** | Limited (deep-link only for groups) | Medium (~9 taps) | ✅ Primary channel |
| **X (Twitter)** | Good (Web Intent) | Low (~6 taps) | ✅ Supported |
| **Facebook** | Degraded (text stripped) | High (~15 taps + re-typing) | ⚠️ Supported with warnings |
| **Instagram** | Effectively none for links | Highest | ❌ Deferred (Phase 1.5) |

**Honest summary:** WhatsApp and X are the primary outbound channels.
Facebook is supported but the experience is degraded by Meta's policy.
Instagram is deferred — it's not designed for our use case.

The product should not pretend all four are equal. Members will be
confused if Facebook is presented as 1-click and then asks them to
re-type their commentary.

---

## WhatsApp — the primary channel

### What WhatsApp lets us do (and not)

- ✅ Open a chat / group via deep link (`whatsapp://send?text=...`)
- ✅ Pre-fill a message with text + URL
- ✅ Member picks recipient(s) from WhatsApp's contact picker
- ❌ No automation API for groups (Business API is Channels-only and
  Phase 2)
- ❌ No way to know if the message was actually sent (member self-reports)

### Pre-configured "Routes"

Members can pre-configure their commonly-used WhatsApp groups as
**Routes**. A Route is a saved destination with:
- Name ("North London Boost Channel")
- Optional notes
- A WhatsApp `chat_id` if discoverable, otherwise just a name (member
  picks the actual chat from WhatsApp's picker each time)

Routes appear as ticked checkboxes in the share menu — fastest workflow
for repeat sharers.

### The flow

Sharon has just posted. The composer's "Want to share it onward?" prompt
appears. She taps WhatsApp.

The share menu shows her configured Routes:

```
╭───────────────────────────╮
│ Share to WhatsApp      ✕ │
├───────────────────────────┤
│                           │
│ Pick groups to share to:  │
│                           │
│ ☑ North London Boost      │
│ ☑ Coordinators UK         │
│ ☐ South-West Region       │
│ ☐ Manchester Action Group │
│                           │
│ ─────────────────         │
│                           │
│ ☐ Other group (choose     │
│    in WhatsApp)           │
│                           │
│ Message preview:          │
│ ┌───────────────────────┐ │
│ │ 🚀 BBC just had a     │ │
│ │ balanced Israel panel │ │
│ │ — worth sharing       │ │
│ │ widely.               │ │
│ │                       │ │
│ │ 📺 https://bbc.co.uk  │ │
│ │                       │ │
│ │ 💬 https://gpsaction. │ │
│ │ org/p/abc123          │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │   Send to 2 groups    │ │
│ └───────────────────────┘ │
│                           │
╰───────────────────────────╯
```

She ticks two routes, taps Send. Then for each route in turn:

1. GPS Action records `dispatch_initiated` for that route (server-side)
2. GPS Action copies the message to clipboard
3. GPS Action opens WhatsApp via deep link (`whatsapp://send?text=...`)
4. WhatsApp opens to the contact picker
5. Sharon picks the group ("North London Boost Channel")
6. WhatsApp shows the pre-filled message in the compose box
7. Sharon taps WhatsApp's Send button
8. WhatsApp sends the message
9. Sharon swipes home / taps back
10. GPS Action reappears with: "Did you send to North London Boost?"
    [Yes] [Not yet] [Skip]
11. Sharon taps Yes → GPS Action records `dispatch_confirmed`
12. GPS Action proceeds to the next route

### Honest friction count for WhatsApp

For 2 routes: ~14 taps total. ~9 for the first route, ~5 each subsequent
(reusing momentum, no need to re-pick destination once familiar).

This is **the real cost of WhatsApp's no-API constraint**. We've made
the experience as smooth as the platform allows. Members understand
WhatsApp is the limiting factor, not GPS Action.

### Confirmation prompt — the critical UX

Step 10 is the make-or-break moment. If Sharon doesn't return to GPS
Action, the dispatch goes unconfirmed. We surface this honestly:

```
╭───────────────────────────╮
│  Did you send to          │
│  North London Boost?      │
│                           │
│  ┌─────────────────────┐  │
│  │       Yes           │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │  Not yet — let me   │  │
│  │  finish in WhatsApp │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │  Skip this one      │  │
│  └─────────────────────┘  │
│                           │
╰───────────────────────────╯
```

"Not yet" returns to WhatsApp. "Skip" closes the loop without recording
a successful dispatch (the Route is marked as "skipped this time").

### Edge cases for WhatsApp

- **Member doesn't have WhatsApp installed.** Deep link fails silently
  on iOS (does nothing) or shows "Couldn't open" on Android. Fallback:
  copy-to-clipboard with a "WhatsApp not installed — message copied"
  toast.
- **Member sends to a different group than expected.** No way to detect.
  We trust their confirmation.
- **Member edits the message before sending.** WhatsApp lets them. Their
  edited version goes; we recorded our intended version. Discrepancy is
  invisible to us.
- **Multi-route session abandoned partway.** Member sent route 1, never
  came back. Route 1 is `dispatch_confirmed`; routes 2-3 are stuck in
  `dispatch_initiated`. After 1 hour, server marks them `abandoned`.

---

## X (Twitter) — Web Intent

### What X lets us do

- ✅ Open compose screen with pre-filled text via Web Intent URL
- ✅ Pre-fill URL, hashtags
- ✅ Member can edit before posting
- ❌ Can't see if they actually posted
- ⚠️ 280 character limit; URL counts as 23 characters

### The flow

Sharon taps "X" in the share menu.

```
╭───────────────────────────╮
│ Share to X             ✕ │
├───────────────────────────┤
│                           │
│ Tweet preview (280 chars) │
│ ┌───────────────────────┐ │
│ │ BBC actually had a    │ │
│ │ balanced Israel panel │ │
│ │ for once. Counters    │ │
│ │ the usual narrative   │ │
│ │ — worth sharing.      │ │
│ │                       │ │
│ │ [URL — 23 chars]      │ │
│ │                       │ │
│ │ #GPSAction            │ │
│ └───────────────────────┘ │
│ 246 / 280 characters      │
│                           │
│ ☑ Include hashtag         │
│   #GPSAction              │
│                           │
│ ☑ Include link to GPS     │
│   Action post             │
│                           │
│ ┌───────────────────────┐ │
│ │     Open in X         │ │
│ └───────────────────────┘ │
│                           │
╰───────────────────────────╯
```

She reviews the preview, optionally toggles the hashtag and GPS Action
link. Taps "Open in X".

GPS Action constructs the Web Intent URL:
```
https://twitter.com/intent/tweet?text=...&url=...&hashtags=GPSAction
```

And opens it. Behaviour depends on platform:

- **iOS, X app installed:** App opens to compose screen with content
  pre-filled
- **iOS, X app not installed:** Browser opens to twitter.com compose
  (logs in if needed)
- **Android:** Same pattern via Android intent system
- **Desktop browser:** Browser opens to twitter.com compose

Sharon reviews the pre-filled tweet, optionally edits, then taps X's
"Post" button.

She returns to GPS Action. Confirmation prompt:

```
╭───────────────────────────╮
│  Did you post to X?       │
│                           │
│  ┌─────────────────────┐  │
│  │       Yes           │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │      Not yet        │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │       Skip          │  │
│  └─────────────────────┘  │
│                           │
╰───────────────────────────╯
```

### Honest friction count for X

~6 taps if she doesn't edit (FAB, X destination, review, Open in X,
Post in X, Yes confirm). Add a few for editing if she changes the text.

This is close to native X experience and acceptable.

### X-specific edge cases

- **Tweet over 280 chars.** GPS Action truncates the body and adds an
  ellipsis with a note: "Truncated to fit Twitter — your full post is at
  [GPS Action link]"
- **Member rewrites the tweet entirely in X.** Their version goes; ours
  was just the starting point
- **X renames a button or URL pattern.** Their changes break our intent
  URL. We monitor this; usually a quick fix.

---

## Facebook — degraded but supported

### What Facebook lets us do (and not)

- ✅ Open a share dialog with a URL pre-filled
- ❌ **Pre-filled text is stripped** — Meta removed this for non-Business
  accounts. Member must re-type their commentary.
- ✅ Member picks audience (Public / Friends / Group)
- ❌ No automation API for personal accounts

### The honest framing

GPS Action must warn the member up front:

```
╭───────────────────────────╮
│ Share to Facebook      ✕ │
├───────────────────────────┤
│                           │
│ ⚠️ Heads up               │
│                           │
│ Facebook doesn't allow    │
│ us to send your message   │
│ along with the link.      │
│ You'll need to type your  │
│ commentary in Facebook.   │
│                           │
│ Two options:              │
│                           │
│ ┌───────────────────────┐ │
│ │  Copy my message,     │ │
│ │  then open Facebook   │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │  Just open Facebook   │ │
│ │  with the link        │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │  Cancel               │ │
│ └───────────────────────┘ │
│                           │
╰───────────────────────────╯
```

This is honest copy in action. We don't pretend it's smooth; we tell the
member what's actually going to happen.

### Path A — "Copy my message, then open Facebook"

1. GPS Action copies the post body to clipboard
2. Toast: "Message copied. Opening Facebook…"
3. Facebook share URL opens: `https://www.facebook.com/sharer/sharer.php?u=...`
4. Facebook's share dialog shows the URL preview
5. Member pastes their commentary into the compose box
6. Member picks audience
7. Member taps Post in Facebook
8. Returns to GPS Action; confirms

### Path B — "Just open Facebook with the link"

1. GPS Action opens the Facebook share URL with no clipboard work
2. Member sees the URL preview only
3. Member types their own commentary fresh
4. Picks audience, posts, returns, confirms

### Honest friction count for Facebook

Path A: ~8 taps + paste + audience-pick + type-additional-commentary.
Path B: similar but more typing.

Either way it's the most expensive flow. Members will use it less. That's
fine — Facebook isn't where movement-relevant action happens for most
of GPS Action's audience.

### Facebook Groups specifically

When a member's Facebook share is going into a *group* (not their wall),
Facebook may or may not let them pick the group from the share dialog.
This is inconsistent across Facebook UI versions. We can't reliably
target a specific group.

If members regularly want to post to specific Facebook groups, the
realistic workflow is: copy our message, switch to Facebook, navigate to
the group, paste. Outside our share flow.

---

## Instagram — deferred to Phase 1.5+

### Why deferred

Instagram has effectively no link-sharing intent. Its strengths are:
- Stories (visual content with optional link sticker)
- Posts (image-first, caption text, link in bio only)
- Reels (video-first)
- DMs (manual, person-to-person)

For GPS Action's text-and-link content, Instagram is a poor fit. We
shouldn't force it.

### What Phase 1.5+ would do

When the image bank and og:image generation lands, we can offer:

**Path: "Share to Instagram Stories"**

1. Member taps Instagram in share menu
2. GPS Action generates a 1080x1920 "story card" image (post body
   rendered as image, GPS Action branded)
3. Image is offered to member's device (download or via deep link)
4. Member opens Instagram, creates a Story, drops the image
5. Member adds a link sticker manually (pointing to the GPS Action
   deep link)
6. Member adds any other stickers/mentions they want
7. Member posts the Story
8. Returns to GPS Action; confirms

This is meaningful work to build well. Defer until image bank + og:image
generation infrastructure exists.

### MVP Instagram behaviour

The Instagram option simply isn't in the share menu in MVP. If a member
asks "where's Instagram?", in-app help explains:

> *"Instagram doesn't allow sharing links the way other platforms do.
> We're working on a way to share visual cards to Stories — coming soon.
> For now, if you want to mention this on Instagram, copy the GPS Action
> link and add it to your Story manually."*

Honest. No false promises.

---

## Common share-flow features

These apply across all platforms:

### Dispatch indicator on the post

After Sharon shares to WhatsApp + X, her post in the feed shows a
dispatch indicator:

```
╭─────────────────────────────╮
│ Sharon Cohen · 2 min ago    │
│                             │
│ "Worth a watch — actually   │
│  balanced for once"         │
│                             │
│ [BBC link preview]          │
│                             │
│ 📱 Sent to:                 │
│  • North London Boost       │
│  • Coordinators UK          │
│  • X (Twitter)              │
│                             │
│ [comments / actions / etc.] │
╰─────────────────────────────╯
```

This is per the dedup spec — visible dispatch state prevents
double-dispatch. Other members see this and can choose to dispatch to
*different* destinations.

### Multi-platform parallel dispatch

If Sharon picks WhatsApp routes + X + Facebook in one share session, GPS
Action handles them sequentially:
1. Cycle through WhatsApp routes (per WhatsApp flow above)
2. Then X (open X compose, return, confirm)
3. Then Facebook (warning + open + confirm)

Each platform's confirmation moment is distinct. We don't try to
auto-confirm "you sent to all 4 destinations" in one tap — each platform
has its own success/skip state.

### Re-share later

A member can return to a post and share it to additional destinations
later. The dispatch indicator updates each time. Useful when:
- Sharon shared to WhatsApp first, decides to also tweet later
- Sharon shared to her own groups, decides to share to a different
  group after a conversation

### "Other GPS members have shared this" visibility

Per the self-dispatch model: Sharon sees Sarah's dispatch to "North
London Mums" before Sharon dispatches herself, so she can pick different
destinations and avoid duplication.

---

## Schema for ERD Slice 2

### `DispatchEvent` table

Each share attempt creates a dispatch event:

```prisma
enum DispatchPlatform {
  whatsapp
  x_twitter
  facebook
  instagram     // Phase 1.5+
  email         // future
  copy_link     // generic
}

enum DispatchState {
  initiated      // member tapped Send / Open in X / etc.
  confirmed      // member confirmed completion
  abandoned      // initiated > 1 hour ago, never confirmed
  skipped        // member explicitly chose to skip this destination
  failed         // share couldn't be initiated (e.g., app not installed)
}

model DispatchEvent {
  id                 String           @id @default(uuid())
  
  postId             String
  post               Post             @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  dispatchedByUserId String
  dispatchedBy       User             @relation("dispatches", fields: [dispatchedByUserId], references: [id], onDelete: Cascade)
  
  platform           DispatchPlatform
  routeId            String?          // FK to Route table if WhatsApp; null for ad-hoc
  destinationLabel   String?          // human-readable: "North London Boost", "X (@sharoncohen)", etc.
  
  state              DispatchState    @default(initiated)
  
  initiatedAt        DateTime         @default(now())
  confirmedAt        DateTime?
  abandonedAt        DateTime?
  
  // Optional context
  messageContent     String?          // what we sent (or attempted to)
  errorReason        String?          // if state = failed
  
  @@index([postId, platform, state])
  @@index([dispatchedByUserId, initiatedAt])
}
```

### `Route` table (WhatsApp pre-configured destinations)

```prisma
model Route {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation("routes", fields: [userId], references: [id], onDelete: Cascade)
  
  name        String          // "North London Boost"
  notes       String?
  platform    DispatchPlatform @default(whatsapp)
  
  // For WhatsApp: optional chat_id if known (most members won't have this)
  externalChatId String?
  
  // Soft delete
  deletedAt   DateTime?
  
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  
  @@index([userId, deletedAt])
}
```

---

## tRPC procedures

| Procedure | Purpose | Auth |
|---|---|---|
| `share.listMyRoutes` | List my configured routes | member |
| `share.createRoute` | Create a new route | member |
| `share.updateRoute` | Update a route | member |
| `share.archiveRoute` | Soft-delete a route | member |
| `share.composeShareMessage` | Generate the platform-specific message text | member |
| `share.recordDispatchInitiated` | Record that share was initiated | member |
| `share.recordDispatchConfirmed` | Member confirms share completed | member |
| `share.recordDispatchSkipped` | Member skipped this destination | member |
| `share.listDispatchesForPost` | List all dispatches for a post (for indicator) | member |

Server-side cron sweeps `state = initiated` events older than 1 hour
and marks them `abandoned`.

---

## Analytics events

| Event | Properties |
|---|---|
| `share_menu_opened` | `postId`, `platforms_available` (array) |
| `share_destination_picked` | `postId`, `platform` |
| `dispatch_initiated` | `postId`, `platform`, `route_id?` |
| `dispatch_confirmed` | `postId`, `platform`, `time_to_confirm_seconds` |
| `dispatch_abandoned` | `postId`, `platform`, `time_to_abandon_seconds` |
| `dispatch_skipped` | `postId`, `platform`, `reason?` |

These feed a "Share-out funnel" dashboard showing per-platform completion
rates, abandonment patterns, and which platforms are most-used.

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **WhatsApp Business API for Channels.** Phase 2; would enable real
   automation for Channel routes but not for Group routes.
2. **LinkedIn sharing.** Out of MVP scope. LinkedIn has a Share API
   similar to X's intent — easy to add later.
3. **Telegram sharing.** Same — easy to add via deep link if movement
   relevance grows.
4. **Email sharing.** Member opens default email app with pre-filled
   subject and body. Easy to add via mailto: link. Probably belongs in
   MVP. *(Adding to "What lands" below.)*
5. **Copy-link as a first-class destination.** Members can always copy
   the GPS Action URL. Worth a explicit "Copy link" option in the share
   menu. *(Adding to MVP.)*
6. **Pre-share editing of the message.** Member sees the message preview
   and edits it before sending. UX consideration; for MVP, message is
   auto-composed and not editable in the GPS Action UI (member can
   edit in the destination platform).
7. **Share to multiple destinations as one tap.** Enabled via the
   route-checkbox model for WhatsApp; cross-platform multi-share is
   sequential (covered above).
8. **Sharing back from external platforms (e.g., quoting a tweet that
   shared a GPS Action post).** Out of scope; would require platform
   APIs we don't have.
9. **Bulk re-share of multiple old posts.** Power-user feature; Phase 2.
10. **Ghost-mode sharing (don't show the dispatch indicator on my
    post).** Phase 2 if real demand.

---

## What lands in MVP

**MVP day 1:**
- WhatsApp share with Routes (pre-configured groups)
- X (Twitter) share via Web Intent
- Facebook share with honest "text stripped" warning
- Email share via mailto: (simple)
- Copy-link as explicit destination
- Per-route confirmation flow ("Did you send?")
- Dispatch indicator on posts in feed
- Multi-platform sequential share
- Sweep of abandoned dispatches (server cron)

**Phase 1.5:**
- Instagram Stories share (via generated story card, depends on image
  bank infrastructure)
- Pre-share message editing in the GPS Action UI
- Better Facebook UX (more guidance for groups)

**Phase 2:**
- WhatsApp Business API for Channels (automation)
- LinkedIn sharing
- Telegram sharing
- Bulk re-share
- Ghost-mode sharing

**Phase 3:**
- Cross-platform analytics integration (member-authorised pulls of
  X/Facebook/etc. analytics back into GPS Action — see
  deep-linking-and-tracking.md)
