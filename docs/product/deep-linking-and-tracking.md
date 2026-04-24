# Deep linking and tracking

**Purpose:** Define how GPS Action posts are linked back to from outside the
platform (WhatsApp, X, Facebook, etc.), what non-members see when they
follow a deep link, what we measure when shares happen, and what we
deliberately do NOT measure.

**Status:** Architectural + product. Affects ERD Slice 2 (Post schema
additions). Will become §3.33 of feature spec.

**Build Unit:** BU-014 (Deep linking + public post views) — to be created.
**Related ADR:** D045 (Public-by-default post visibility), D047 (Honest
tracking only).
**Related:** `inbound-sharing.md` (BU-010 — content coming in),
`share-out-mechanics.md` (BU-013 — content going out),
`design-philosophy.md` principle 5 (honest copy).

---

## Why this matters more than it looks

When Sharon shares a GPS Action post into her WhatsApp group, recipients
need a path back to GPS Action — to comment, react, take action, or join.
Without that path, GPS Action is invisible to recipients; they see only the
content that was being amplified (the BBC link, the petition URL).

This affects **who GPS Action is for**:

- If we don't link back: GPS Action is a _backstage tool_ — invisible to
  the wider audience, used only by members
- If we do link back: GPS Action becomes a _destination_ recipients can
  reach, see, and choose to join

Both are legitimate. The current design lands on **a hybrid** — the
shared content is the immediate value (watch the video, sign the
petition), but a GPS Action deep link is also included so recipients
_can_ discover the discussion if they want.

This document defines how that works.

---

## The deep link itself

### URL structure

```
https://gpsaction.org/p/{shortId}
```

- **Short, memorable.** No long UUID, no nested paths.
- **No author prefix.** Doesn't leak the author's username to non-members.
- **Single-segment path.** Easy to recognise as a "GPS Action post link"
  in any context.

`{shortId}` is an 8-character alphanumeric string (a-z, A-Z, 0-9 minus
ambiguous characters like `0/O`, `1/l/I`). 8 chars across ~58 alphabet =
~128 trillion possible IDs. Collision-resistant for any plausible scale.

Generated at post creation time, indexed, immutable. Stored in
`Post.shortId`.

### Domain

For MVP, `gpsaction.org` (or whatever the production domain becomes — the
naming question is parked, see decision log). The deep link domain is
the **same** as the application domain. No separate `link.gpsaction.org`
or shortener service.

Why: keeps trust signals consistent. Recipients see a `gpsaction.org` URL
in their WhatsApp message and know it's the same product. Shorteners add
a redirect hop and reduce trust ("is this really GPS Action?").

### What's NOT in the URL

- **Not the post title.** Many posts won't have natural titles, and putting
  text in URLs causes encoding issues, broken links when titles change,
  and SEO-style brittleness.
- **Not the author username.** Privacy posture — non-members shouldn't see
  who posted from the URL alone.
- **Not the post type.** Implementation detail; doesn't matter to recipients.
- **Not the date.** Implementation detail.

A future "vanity URL" option (e.g., `gpsaction.org/p/abc123/bbc-balanced-panel`)
could be added — the slug after the shortId is ignored by the router but
helps in WhatsApp link previews. **Deferred.** Not in MVP.

---

## Three recipient cases — what they see

When a deep link is tapped, the recipient lands on the post. Three cases
based on their relationship to GPS Action:

### Case 1 — Recipient is a signed-in member

**Standard authenticated path.** They see the full post detail page:

- Post body, hero image, links
- Comments
- Reactions, action counts
- Who's dispatched it where (the dispatch indicator)
- Their own action options ("Take this action", "Boost this", "Share")
- All the normal feed-item interactions

This is the default and easy case. Most deep-link traffic from existing
members is this case.

### Case 2 — Recipient is a member but not signed in

**Auth redirect with destination preserved.**

1. They tap the URL
2. Hit `gpsaction.org/p/abc123` while not authenticated
3. Server redirects to login: `/login?next=/p/abc123`
4. After successful login, they land on the post

Standard `?next=` pattern. Their cookies got cleared, or they're on a new
device, or they signed out — common. The redirect ensures they don't lose
the destination.

### Case 3 — Recipient is NOT a GPS Action member (the interesting case)

What they see depends on the **post's visibility setting**:

#### Visibility: `public` (default for most post types)

They see a **public post view**:

- Post body, hero image, original linked content
- A small "joined GPS Action via this post" CTA at the bottom
- The author's first name only ("Posted by Sharon" — not surname)
- Action counts ("47 members took action") — but no list of who
- **No comments visible** (comments are member-only even on public posts)
- **No dispatch indicators** (operational detail, not for non-members)
- **No "take action" buttons** (those require membership)

The page renders server-side, includes proper Open Graph metadata, and is
indexable by search engines (a separate decision, see below).

#### Visibility: `members_only`

They see a **gentle members-only page**:

- "This post is shared within GPS Action's members."
- A short, honest description of what GPS Action is
- A "Request to join" CTA
- **The post content itself is NOT shown** — not even an excerpt

#### Visibility: `private`

They see a **404 / not-found page**:

- Indistinguishable from a deleted or non-existent post
- No leak that a post with this ID exists or is private
- Used for sensitive content (vetting context, incident reports,
  internal coordination)

---

## Visibility settings — author control

Every post has a `visibility` field with three values:

| Value          | Default for                                                | Recipient (non-member) sees | Indexed by search engines  |
| -------------- | ---------------------------------------------------------- | --------------------------- | -------------------------- |
| `public`       | Boost, Action, Event, generic                              | Public post view            | Yes (with noindex opt-out) |
| `members_only` | Internal coordination, sensitive ops                       | "Members only" page         | No                         |
| `private`      | Incident reports, vetting context, anything author chooses | 404                         | No                         |

### Defaults by post type

The composer auto-sets a default visibility based on the post type the
member chose (per the FAB cards model — see `post-creation-flow.md`):

- **Share a link** → `public` (the whole point is amplification)
- **Call for action now** → `public` (urgency wants reach)
- **Boost something** → `public`
- **Tell us about an event** → `public` (events benefit from public discoverability)
- **Just write something** → `members_only` (default conservative)
- **I'm not sure** (generic composer) → `members_only` (default conservative)
- **Incident report** (per scenarios — sensitive) → `private`

### Author override

In the composer, a small visibility toggle is always visible:

```
Visibility: Public ▾
  ◯ Public — anyone with the link can read it
  ◯ Members only — only signed-in members can read it
  ◯ Private — only you and admins can read it
```

The default is set by the post type, but the author can change it before
posting and after posting (with audit log entry).

### Why public-by-default

The argument was made and accepted (per D045) that GPS Action's value
includes being a destination recipients can reach. Default-private would
neuter the deep-link concept. Default-public matches the purpose of most
post types (amplification, action-prompting, event publicising).

The author always has control to make any specific post tighter.

---

## Server-side rendering and Open Graph metadata

The deep-link URL **must** render server-side. Two reasons:

1. **Link previews work.** When the URL is pasted into WhatsApp/X/Facebook,
   those platforms fetch the page server-side to generate a preview card.
   Client-rendered pages get an empty preview.
2. **Search engine indexing** (for public posts). Public posts can be
   discovered via search if we want — server-side rendering is a
   prerequisite.

### Open Graph metadata served per post

The page at `gpsaction.org/p/abc123` returns HTML with these meta tags:

```html
<meta property="og:title" content="Sharon shared on GPS Action" />
<meta property="og:description" content="[first ~150 chars of post body]" />
<meta property="og:image" content="https://gpsaction.org/p/abc123/og-image" />
<meta property="og:url" content="https://gpsaction.org/p/abc123" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="GPS Action" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@gpsaction" />
```

For `members_only` and `private` posts:

- `og:title` is generic ("GPS Action — Members-only post" or "GPS Action")
- `og:description` is generic ("This post is shared within GPS Action.")
- `og:image` is a generic GPS Action card (no post content leaked)
- The actual page content is the gated landing

### og:image generation — the centerpiece

This is where it really matters. The `og:image` for a post URL is what
recipients **see first** in WhatsApp/X/Facebook before deciding whether
to tap. A great og:image dramatically increases tap-through.

Two tiers based on post and phase:

#### Tier 1 (MVP day 1) — Static fallback or pulled-through

- If the post has a `heroImageUrl` (set from the linked content's
  og:image, per `image-handling.md`), use it directly as the post's
  outbound og:image
- Otherwise, use a static GPS Action branded image per post type
  (~5 PNG variants, shipped with the app)

This is simple and ships day 1.

#### Tier 2 (Phase 1.5+) — Generated cards

A dedicated route `gpsaction.org/p/{shortId}/og-image` returns a generated
PNG (1200x630 — standard og:image dimensions) using Next.js's
`@vercel/og` library. The generated image is a card that contains:

- The post's first sentence rendered in clean typography
- The author's first name
- A small GPS Action logo
- Type-appropriate accent colour (per design philosophy bordeaux for
  cultural posts, etc.)
- The hero image as a small inset if available

The generation runs **on first request**, then the result is cached
(in object storage or via CDN) so subsequent requests are fast.

This Tier 2 is **significantly more polished** than Tier 1 and is what
makes shared posts look genuinely well-presented across platforms. But
it's added complexity (image generation infrastructure, font assets,
caching layer) so we ship Tier 1 first and add Tier 2 in Phase 1.5.

### Search engine indexing

By default, public posts include `<meta name="robots" content="index,follow">`.
This means Google can discover and rank GPS Action posts.

**Why this might be wanted:** discoverability, organic growth.

**Why this might be unwanted:** sensitive topics, adversary surveillance,
member privacy concerns ("I didn't realise my post was Google-able").

**Our approach for MVP:**

- Public posts default to `index,follow` ONLY for post types where
  discoverability is the point (Boost, Event, Action)
- For all other public posts, default to `noindex,follow` (Google can
  follow links but won't index the page)
- Author can override per-post in the composer's visibility settings
  ("Allow this post to appear in search results" toggle)
- A site-wide `robots.txt` allows crawling of `/p/*` paths but not
  `/admin/*` or `/queue/*`

This is conservative. A public post that Sharon posts about a Manchester
event won't appear on Google by default, but Sharon can choose to allow
it if she wants the SEO reach.

---

## Deep linking on mobile devices

Recipients tap the URL inside another app (WhatsApp, X, etc.). What
happens depends on whether GPS Action is installed as a PWA on their
device.

### Recipient has GPS Action PWA installed

- iOS: tapping the link opens GPS Action's PWA in the home-screen launcher
  (if iOS recognises the URL pattern matches an installed PWA — which it
  does for properly configured PWAs)
- Android: same pattern via Android's intent system
- They land on the post in the PWA, signed in if they have a session

### Recipient does NOT have GPS Action PWA installed

- The URL opens in their default browser (Safari on iOS, Chrome on Android)
- They see the post in a browser tab
- For public posts: full content visible (Case 3 above)
- For members-only / private: gated landing page

The browser experience is acceptable but degraded. Each public-post
landing page includes a subtle **"Install GPS Action for the full
experience"** prompt — a banner with the install instructions for their
platform.

### Apple's Universal Links (or Android App Links) for native apps

Not relevant in MVP — we're PWA-only (per D003 + Path A in
`inbound-sharing.md`). When/if native iOS arrives (B11 in engineering
roadmap), Universal Links will be configured so deep links open the
native app instead of Safari.

---

## What we measure when shares happen

Five events worth tracking, all anonymous-by-default:

### 1. `dispatch_initiated`

**When:** Member taps a share destination (WhatsApp / X / Facebook /
Instagram) in the share menu.
**Properties:** `postId`, `destinationPlatform`, `destinationDetail?`
(WhatsApp group name if available)
**Reliability:** High — we know they pressed the button.
**What it tells us:** "How often are members sharing? To which platforms?"

### 2. `dispatch_confirmed`

**When:** Member returns to GPS Action after the platform handoff and
confirms the share completed.
**Properties:** `postId`, `destinationPlatform`, `timeFromInitiationMs`
**Reliability:** Medium — depends on member returning + confirming.
Some shares get done but never confirmed.
**What it tells us:** "Are members completing share flows or abandoning
them? Where do drop-offs happen per platform?"

### 3. `deep_link_view`

**When:** Anyone (member or non-member) loads `gpsaction.org/p/{shortId}`.
**Properties:** `postId`, `referrerDomain` (whatsapp.com, twitter.com,
direct, etc.), `wasAuthenticated` (bool), anonymous session hash.
**Reliability:** High — it's a real HTTP hit.
**What it tells us:** "How many people are landing on this post via
shares? Which platforms drove them?"

### 4. `non_member_landed`

**When:** Subset of `deep_link_view` where `wasAuthenticated = false`.
**Properties:** Same as above.
**Reliability:** High.
**What it tells us:** "Is GPS Action being seen by non-members? Are
shares actually reaching new audiences?"

### 5. `non_member_signup_attributed`

**When:** A new signup happens within 7 days of a `non_member_landed`
event from the same anonymous session.
**Properties:** `postId` (the landing post), `daysFromLanding`
**Reliability:** Medium — session-based attribution is approximate.
**What it tells us:** "Are deep links driving real signup growth? Which
posts are most magnetic?"

### Combined dashboard

These five events feed a "Reach scoreboard" per post, visible to:

- The author (their own post's reach)
- Admins (any post)

The scoreboard shows:

- Number of dispatches, by platform
- Number of deep-link views, by referrer platform
- Number of non-member landings
- (Eventually) number of attributed signups

**What we explicitly do NOT show on the scoreboard:**

- Estimated platform reach (likes, retweets, impressions on X) — we don't
  know
- Estimated WhatsApp forwards — we can't see beyond the first hop
- Inferred "audience reached" numbers based on multipliers — guesswork

---

## What we cannot measure (and how we handle that honestly)

This is the discipline section. Per D047 and design-philosophy principle
5, the product must NOT inflate numbers to look impressive.

### We cannot measure

**Third-party platform impressions** — How many people saw Sharon's
tweet, the WhatsApp message in Northwood Mums, the Facebook share. These
platforms don't tell us. Period.

**Third-party engagement** — Likes, retweets, replies on her tweet.
Reactions in the WhatsApp group. Comments on Facebook. Same reason.

**Onward forwarding** — When Sarah forwards Sharon's WhatsApp message to
_her_ WhatsApp groups. Invisible to us. Original deep links continue to
fire counters but we can't distinguish "Sarah forwarded" from "the
message went viral organically".

**Off-platform action** — When someone watches the BBC video Sharon
linked, does anything in the world. Outside our visibility entirely.

### How we describe what we know

In UI copy, we are precise about scope:

✅ **Honest:**

- "47 views via direct GPS Action link"
- "Shared by 12 members to WhatsApp groups"
- "3 new members joined after landing on this post"

❌ **Misleading (banned):**

- "Reached approximately 12,000 people" (made up)
- "Got 47 likes on Twitter" (we don't know)
- "Trending on Facebook" (we have no signal for this)

### Three ways future work could add reach data

These are all parking-lot items, not in MVP:

1. **Member self-reporting.** Sharon manually enters "my tweet got 4,200
   impressions, 12 retweets" from her X analytics. Annoying; nobody does
   it consistently.

2. **API integration with member's accounts.** With Sharon's auth, GPS
   Action pulls her own X/Facebook analytics. Real numbers; significant
   engineering and privacy implications.

3. **UTM tagging on outbound links.** When Sharon shares to X, the BBC
   URL becomes `bbc.co.uk/...?utm_source=gpsaction&utm_medium=x&utm_campaign=post_abc123`.
   BBC's analytics see GPS Action traffic; we don't get the data, but we
   help broader signal. Cluttered URLs make this controversial.

All three are deferred. The honest in-house measurements (1-5 above) are
sufficient for MVP.

---

## Schema additions for ERD Slice 2

When the Post entity is built in Slice 2, these fields land:

```prisma
model Post {
  // ... other fields ...

  shortId               String              @unique  // 8-char public ID
  visibility            PostVisibility      @default(members_only)  // overridden by composer

  // og:image — populated when post is created or updated
  ogImageUrl            String?             // S3/Vercel Blob URL of generated card
  ogImageStatus         OgImageStatus       @default(pending)
  ogImageGeneratedAt    DateTime?

  // Indexability
  allowSearchIndex      Boolean             @default(false)  // composer-set; defaults vary by type

  // Reach metrics (denormalised counters, updated on event)
  deepLinkViewCount     Int                 @default(0)
  nonMemberViewCount    Int                 @default(0)

  // ... other fields ...

  views                 PostView[]
  dispatchEvents        DispatchEvent[]

  @@index([shortId])
  @@index([visibility, createdAt])
}

enum PostVisibility {
  public
  members_only
  private
}

enum OgImageStatus {
  pending     // not generated yet
  generating  // worker is creating it
  ready       // available
  failed      // generation failed; fall back to static
}
```

New table for tracking views (separate from analytics events because we
need fast counters, not just analytics):

```prisma
model PostView {
  id                      String    @id @default(uuid())
  postId                  String
  post                    Post      @relation(fields: [postId], references: [id], onDelete: Cascade)

  viewedAt                DateTime  @default(now())

  // Anonymous session tracking — hashed, not raw
  anonymousSessionHash    String    // sha256(session_cookie + salt)

  // Where they came from
  referrerDomain          String?   // "whatsapp.com", "twitter.com", "direct", etc.

  // Were they signed in?
  wasAuthenticated        Boolean   @default(false)

  @@index([postId, viewedAt])
  @@index([anonymousSessionHash])  // for de-duplicating bot traffic
}
```

`DispatchEvent` is covered in `share-out-mechanics.md`.

---

## Implementation considerations

### Caching strategy

- Public post HTML pages: cached at the edge (Vercel Edge Network) with a
  short TTL (60 seconds). Updates within a minute when post body changes.
- og:image PNGs: cached at the edge with long TTL (24 hours). Cache-bust
  with a query param if the image is regenerated.
- Static placeholder images: cached forever (immutable assets shipped with
  the app).

### Bot traffic and abuse

Deep links are public URLs. Bots will hit them.

- Server-side rendering serves the same content to bots as to humans
  (Google's recommendation; avoids cloaking complaints)
- View counts dedupe by `anonymousSessionHash` so a bot hitting 1,000
  times = ~1 view counted
- Rate limiting on `/p/*` paths: 100 req/min per IP, with abuse logging
- `robots.txt` allows respectful crawlers; bad actors get rate limited

### Deletion behaviour

When an author deletes a post:

- The deep link returns 404 (the post is gone)
- Cached HTML at the edge is purged
- Cached og:image is purged
- Existing shared messages still exist on WhatsApp/X/etc. but the link
  goes nowhere — this is acceptable and expected behaviour for a deleted
  post

### Visibility change behaviour

When an author changes visibility from public to members_only:

- Edge cache is purged
- Future deep-link visits show the gated landing page
- Existing shared messages with the deep link still work but show the
  gated landing instead of the post
- An audit log entry is recorded
- The author is shown a confirmation: "Existing shares of this post will
  now show 'members only' to non-members."

When changing private to public: similar audit + cache invalidation.

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **The actual og:image card design.** Generated card layout, fonts,
   colours, positioning of post text. Design work, not architecture.
   Specified per Build Unit when og:image generation lands.
2. **Bot detection sophistication.** "Is this Googlebot or a malicious
   scraper?" — handled at infrastructure layer (Vercel firewall + rate
   limiting), not in app code.
3. **Internationalisation of public landing pages.** English-only for
   MVP. Localisation later.
4. **Custom domains for posts.** "sharon.gpsaction.org/post/abc" or
   similar. Vanity, not needed. Parking lot.
5. **QR codes for posts.** Useful for printed materials. Phase 2.
6. **Embed codes** ("embed this post on your blog"). Phase 2.
7. **Social previews beyond og:image.** Twitter Cards extended formats,
   LinkedIn-specific tags. We use the basics; Phase 2 might add platform-
   specific extensions.
8. **Deep links to specific comments or actions within a post.**
   `gpsaction.org/p/abc123#comment-456`. Useful for commentary-driven
   conversations. Phase 2.
9. **Branch.io or similar deep-link SaaS.** We're using vanilla URLs. If
   complexity grows (mobile install attribution, deferred deep linking
   for new installs), evaluate SaaS solutions then.
10. **Privacy-preserving attribution** beyond hashed sessions. If
    fingerprinting or third-party cookies become relevant, that's a
    bigger conversation.

---

## What lands in MVP

To be clear about scope:

**MVP day 1:**

- Short IDs generated on every post
- Public-by-default per post type, with composer override
- Server-side rendering for public posts
- og:image fetching from linked URL (Tier 1) — no generated cards yet
- Static og:image fallback per post type
- Basic deep-link view tracking (the 5 events above)
- Visibility settings (public / members_only / private) honoured
- Members-only and private landing pages
- Edge caching of HTML and images
- Rate limiting on public paths

**Phase 1.5 (a few weeks in):**

- Generated og:image cards (Tier 2, the polished version)
- "Reach scoreboard" UI for authors
- "Install GPS Action" prompts on browser-rendered public pages
- Audit log for visibility changes

**Phase 2:**

- Member self-reporting of platform stats
- Custom domains
- Embed codes
- QR codes
- Comment-level deep links
- Native iOS deep linking via Universal Links

**Never (or only on strong product signal):**

- Inflated reach estimates
- Pretend-engagement metrics
- Aggressive non-member nag screens
- UTM tagging without member consent
