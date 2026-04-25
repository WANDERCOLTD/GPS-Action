# Image handling

**Purpose:** Define how images appear throughout GPS Action — for member
avatars, post hero images, group logos, ambient styling, and outbound
share previews. Phased adoption from "simple day 1" through to "richer
in Phase 1.5+".

**Status:** Architectural + product. Affects ERD Slice 2 (Post fields)
and various entity tables. Will become §3.35 of feature spec.

**Build Unit:** BU-image (Image handling foundation) — to be created.
**Related ADR:** D046 (Image handling phased strategy — day 1 simple).
**Related:** `deep-linking-and-tracking.md` (og:image generation),
`design-philosophy.md` (cultural-marker styling, no anxiety amplification),
`groups.md` (group logos), `coordinator-profile` in admin-surface.md
(coordinator group logos).

---

## Four image concepts (often confused)

There are four different "images" in GPS Action, with different sources,
storage, lifecycles, and use:

| Concept                    | What                                                                    | When set                            | Where shown                                         |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| **Member avatar**          | Photo or initials of a member                                           | At signup; can update later         | Post bylines, profile, comments                     |
| **Group logo**             | Image identifying a group                                               | When admin creates group            | Group page, group badges                            |
| **Coordinator group logo** | Logo for an external group a member runs                                | When member adds the group          | Coordinator profile, future amplification analytics |
| **Post hero image**        | The visual content of the post itself                                   | At post-creation time               | Post card in feed, post detail page                 |
| **Outbound og:image**      | The preview card non-members see when the post URL is shared externally | Generated server-side from the post | WhatsApp / X / Facebook / etc. link previews        |
| **Ambient styling**        | Background colours, accent strips, type-driven visual treatment         | Defined by post type                | Post card framing                                   |

(That's six concepts now — splitting "logo" by source clarifies. Five
images, one styling concept.)

---

## The phased adoption model

Per D046, images get richer in phases. Day 1 is deliberately simple to
ship; complexity arrives when use proves value.

### Phase: MVP day 1 (the simple ship)

**What members can do:**

- Upload an avatar at signup (or use auto-generated initials placeholder)
- Paste a URL when composing → server fetches og:image from it; that
  becomes the post's hero image
- See a default placeholder hero if their post has no URL or the URL
  has no og:image

**What admins can do:**

- Edit any member's avatar (rare; for moderation cases)

**What does NOT exist yet:**

- Member-uploaded post images (they can't upload a hero image directly;
  it's pulled from URLs only)
- Group logos (groups exist but use default icons)
- Coordinator group logos (members can describe groups they run, but
  no logo upload yet)
- Curated image bank (no shared library to pick from)
- Generated og:image cards (Tier 1 only — pulled-through or static
  fallback)

This is genuinely minimal. It works because:

- Most posts will share URLs (BBC, Twitter, news sites) — those have
  og:images
- Members are humans with avatars; that's all the personalisation MVP
  needs
- Group logos can wait until Phase 1.5 (groups are themselves new in
  Slice 1.5)

### Phase: 1.5 (a few weeks after MVP launch)

**What members can do (newly):**

- Upload a logo for any group they run (coordinator profile)
- Pick from a curated image bank when composing (~30 images: flags,
  symbols, generic action graphics)

**What admins can do (newly):**

- Upload group logos (for the GroupS feature)
- Curate the image bank (add, retire, tag images)
- See generated og:image cards for outbound shares (Tier 2 — see
  `deep-linking-and-tracking.md`)

**What lands:**

- Member-uploaded image files (with size/type/safety constraints)
- Image bank: curated, taggable, browsable
- Generated og:image cards (the "GPS Action share card")

### Phase: 2

**What members can do (newly):**

- Upload custom hero images for their own posts (not just URL-derived)
- Submit images to the curated bank for admin review

**What admins can do (newly):**

- Manage submitted images (approve/reject queue)
- Bulk-tag the image bank
- Curate per-post overrides

**What lands:**

- Member submission queue for image bank additions
- Per-post image override (admin can swap a bad og:image for a better one)
- Image moderation pipeline (auto-detect adult content, gore, etc. — third-
  party API)

### Phase: 3

**Newly:**

- AI-generated images for posts on demand (text → image generation)
- Animated content (GIFs, short videos)
- Branded image templates (member can pick a "GPS Action template" and
  customise)

These are nice-to-haves; only if real demand surfaces.

---

## Member avatar — day 1 details

### Source

Two options, member's choice at signup:

1. **Upload a photo** — JPG, PNG, or WebP. Max 2MB. Cropped square. Stored
   in object storage (S3 / Vercel Blob / R2).
2. **Use generated initials** — server generates a coloured circle with
   the member's initials. No upload needed. Colour deterministic from
   user ID hash (so it's stable across sessions).

The initials variant is the default if no photo uploaded. Members can
update later via profile settings.

### Sizes served

The server stores the original at max 1024x1024 and serves three derived
sizes:

- `avatar_small` — 32x32 (for byline, comment avatars)
- `avatar_medium` — 96x96 (for profile cards)
- `avatar_large` — 256x256 (for the profile page itself)

Generated lazily on first request, cached forever (immutable URLs with
hash-based cache busting if the original changes).

### Schema

```prisma
model User {
  // ... existing fields ...

  avatarUrl         String?     // null = use generated initials
  avatarUploadedAt  DateTime?

  // ... existing fields ...
}
```

That's it. The "generated initials" path is rendered client-side from
the user's `displayName` and a deterministic colour from `id`. No DB
storage needed for the placeholder.

### Where avatars appear

- Post bylines (24px circle)
- Comment bylines (24px)
- Profile page header (96px)
- Group member lists (40px)
- Mention chips inline in comments (16px)

Each context uses the closest stored size. No ad-hoc resizing.

### Privacy and moderation

- Member's avatar is visible to all signed-in members (it's how the
  community recognises each other)
- Non-members on public post pages see avatars too (same as members
  see them)
- Admins can replace an inappropriate avatar with the initials placeholder,
  with audit log entry
- Members can replace their avatar at any time

---

## Post hero image — day 1 details

### Where it comes from

For MVP day 1, exactly one source: **scraped from the URL the member
included in the post**.

When a member composes a post that includes a URL:

1. Composer detects the URL
2. Server-side, GPS Action fetches the URL with a real-browser-style
   user agent
3. Parses the response for Open Graph tags:
   - `og:image` (primary)
   - `og:image:url` (fallback)
   - `twitter:image` (fallback)
   - First `<img>` in the body if all else fails (last resort)
4. Downloads the image, resizes to standard 1200x630 (16:9 cropped
   appropriately), stores in object storage
5. Saves the URL to `Post.heroImageUrl`
6. The downloaded file becomes the source of truth (we don't re-fetch
   later; the original site might 404)

### What if there's no URL?

- The composer offers a fallback: a **generic placeholder image per post
  type**
- Five SVGs shipped with the app (one per post type; bordeaux for
  cultural, accent for action, etc.)
- The chosen placeholder is referenced in `Post.heroImageUrl` (or via a
  separate `heroImagePlaceholder` field — TBD in implementation)

### What if the scrape fails?

- Network error, 404, no metadata: log it; fall back to the
  type-appropriate placeholder
- Don't show the member an error ("Couldn't get image from BBC URL") —
  it's noise; the placeholder is an acceptable substitute
- If the member specifically wants their own image, they need Phase 2's
  custom upload feature

### What if the og:image is sensitive?

This is a real concern. A linked article about an attack might have a
graphic image. We're embedding it in our feed.

For MVP day 1: **no automatic detection**. We rely on author judgement
(they chose to link the article) and admin moderation (any reported
post can be reviewed; admins can replace the hero with placeholder).

Phase 2 adds a third-party content moderation API (e.g., AWS Rekognition,
Sightengine, Google Vision) to flag potentially graphic images before
they're displayed.

For MVP, members can flag any post as inappropriate (per the existing
flag flow); a flagged post enters the queue and a queue manager can
replace the image with a placeholder while the post is reviewed.

### Schema

```prisma
model Post {
  // ... existing fields ...

  heroImageUrl         String?            // S3/Blob URL of cached/uploaded image
  heroImageSource      HeroImageSource    @default(none)
  heroImageOriginalUrl String?            // the URL the og:image was scraped from
  heroImageAltText     String?            // accessibility — auto-generated or member-provided
  heroImageStatus      HeroImageStatus    @default(pending)

  // ... existing fields ...
}

enum HeroImageSource {
  none
  og_metadata        // scraped from a URL
  member_uploaded    // member uploaded their own (Phase 2+)
  image_bank         // picked from curated bank (Phase 1.5+)
  placeholder        // type-default fallback
}

enum HeroImageStatus {
  pending            // not fetched yet
  fetching           // worker is downloading
  ready              // available
  failed             // fetch failed; using placeholder
  flagged            // flagged for review; placeholder shown
}
```

### Caching

- Cached image files in object storage have content-hash URLs
  (`/img/posts/{contentHash}.jpg`) — immutable
- CDN caches them with year-long TTLs
- Resizes (small / medium / large) generated lazily and cached the same
  way

---

## og:image for outbound shares (intertwined with deep-linking-and-tracking.md)

When the GPS Action URL `gpsaction.org/p/abc123` is pasted into WhatsApp /
X / Facebook, those platforms fetch the page and look for `<meta property="og:image">`.

What they find is what recipients see in the link preview. This matters
enormously — it's the visual "first impression" of GPS Action to people
who don't know us yet.

### Two-tier strategy (matches the deep-linking-and-tracking spec)

#### Tier 1 (MVP day 1)

The og:image served at `gpsaction.org/p/abc123` is the same image as the
post's hero (which itself was scraped from the linked URL or is a
placeholder).

```html
<meta property="og:image" content="https://cdn.gpsaction.org/img/posts/{contentHash}.jpg" />
```

This works but has a downside: the image is the BBC's article image (or
similar). Recipients see "BBC article preview" — they might not realise
this is from GPS Action.

For posts with a generic placeholder hero (no URL, type-default), the
og:image is the placeholder. That's clearly GPS Action branded.

#### Tier 2 (Phase 1.5+)

A dedicated route generates a **GPS Action-branded card** as the og:image:

```
GET https://gpsaction.org/p/{shortId}/og-image
Returns: PNG, 1200x630, cached
```

The generated card contains:

- The post's first sentence (or full body if short), rendered in clean
  typography
- The author's first name + their group badge if they have one
- A small GPS Action logo (top corner)
- Type-appropriate accent colour (bordeaux for cultural, action accent
  for action posts)
- The hero image (if any) inset as a small thumbnail

This is significantly more polished than Tier 1. Recipients see "Sharon
shared this on GPS Action" with the post text rendered clearly — they
immediately understand they're being invited into a community
conversation, not just shown a BBC article.

Tier 2 uses Next.js's `@vercel/og` library — generates PNGs from React
components on demand. First request generates and caches; subsequent
requests serve from cache.

### Schema

```prisma
model Post {
  // ... existing fields ...

  ogImageUrl              String?             // cached generated card URL (Tier 2)
  ogImageStatus           OgImageStatus       @default(pending)
  ogImageGeneratedAt      DateTime?

  // ... existing fields ...
}

enum OgImageStatus {
  pending             // not generated yet (uses Tier 1 fallback)
  generating          // worker is creating it
  ready               // Tier 2 cached and serving
  failed              // generation failed; falls back to Tier 1
}
```

### When generation runs

- **Lazy by default.** Generated on first request to `/p/{shortId}/og-image`
- **Eager for high-priority posts.** When an admin marks a post as
  important, generation runs immediately (so the first share has a good
  card)
- **Re-generated on visibility change.** If post visibility changes, the
  card might need updating

---

## Group logo — Phase 1.5

When the Groups feature ships (Slice 1.5), each group can have a logo.

### Source

- **Admin uploads.** When creating or editing a group, admin uploads a
  logo file (JPG / PNG / SVG, max 1MB)
- **Default icon.** If no logo, a generic group icon shown (one icon for
  all groups; differentiated by name, colour from group ID hash)

### Sizes

Same approach as avatars: original at max 1024x1024, derived sizes at
24px (badge), 64px (chip), 128px (group page header).

### Schema

```prisma
model Group {
  // ... existing fields ...

  logoUrl    String?          // null = use default icon

  // ... existing fields ...
}
```

### Where group logos appear

- Group badges on member profiles (24px)
- Group page header (128px)
- Group chip in the queue's group filter (24px)
- Future: post bylines (when a post is tagged with a group, optionally
  show the group logo near the byline)

---

## Coordinator group logo — Phase 1.5

Members who run external groups can upload logos for those groups (per
the existing coordinator_profile spec).

### Source and storage

Same pattern as group logos. Member uploads at the time they add a
coordinator group to their profile.

### Schema (already in admin-surface.md)

```prisma
model CoordinatorGroup {
  // ... existing fields ...

  logoUrl    String?          // member-uploaded

  // ... existing fields ...
}
```

### Where they appear

- Coordinator's profile page (next to each group they run)
- Future amplification analytics ("Sharon's reach: 5,000 across 3 groups
  [logo logo logo]")

---

## Curated image bank — Phase 1.5

A shared library of images members can pick from when composing.

### Bootstrap content

Admins curate ~30 images for launch:

- UK flag, Israeli flag
- Star of David, Menorah, Shabbat candles
- Generic action symbols (megaphone, raised fist, ballot box, scales of
  justice)
- Backgrounds for cultural moments (bordeaux gradient, calm landscape)
- Generic placeholder hero images (the same 5 used as type-defaults)

### Browse and pick UI

In the composer (Phase 1.5+), an "Add image" button opens an image picker:

- Browse by category (flags, symbols, backgrounds, etc.)
- Search by tag
- See previews
- Pick one → it becomes the post's hero image

### Member submissions to the bank — Phase 2

A "Submit your own image to the bank" flow:

- Member uploads
- Adds tags / suggests categories
- Submission enters a `work_item` queue (type: `image_bank_submission`)
- Admin reviews, approves with metadata, or rejects with reason
- Approved images appear in the bank

### Schema

```prisma
model ImageBankItem {
  id            String              @id @default(uuid())
  slug          String              @unique

  url           String              // primary image URL
  altText       String              // required; admin-curated for accessibility
  tags          String[]            @default([])
  category      String              // "flag", "symbol", "background", etc.

  status        ImageBankItemStatus @default(pending)

  uploadedByUserId String
  uploadedBy    User                @relation("imageBankUploads", fields: [uploadedByUserId], references: [id], onDelete: Restrict)
  uploadedAt    DateTime            @default(now())

  curatedByUserId String?
  curatedBy     User?               @relation("imageBankCurations", fields: [curatedByUserId], references: [id], onDelete: SetNull)
  curatedAt     DateTime?

  retiredAt     DateTime?

  @@index([status, category])
  @@index([tags], type: Gin)
}

enum ImageBankItemStatus {
  pending
  curated
  rejected
  retired
}
```

---

## Sensitive content — three concerns

### Concern 1: og:image content from external links

A linked article about an attack might have a graphic image. We embed it.

**MVP day 1 mitigation:**

- Member can flag any post → admin reviews → can replace hero with
  placeholder
- Author judgement is the primary line of defence (they chose to link)

**Phase 2:**

- Third-party content moderation API checks every fetched og:image
- Auto-flag obviously graphic content for human review before display
- "Show preview images?" toggle in member settings

### Concern 2: Member-uploaded content (Phase 2+)

When members can upload their own hero images and bank submissions, the
risk of inappropriate content rises.

**Phase 2 controls:**

- Same moderation API on uploads
- Submission queue for bank items
- Member upload size and type restrictions
- Auto-watermark uploads with anonymous origin (so screenshots can be
  traced)

### Concern 3: Member-visible avatars

A member's avatar is visible to all signed-in members.

**MVP day 1 mitigation:**

- Members upload their own; no third-party detection
- Admins can replace an inappropriate avatar with placeholder (audit
  logged)
- Reporting flow: any member can report an avatar; flagged avatars enter
  the queue

**Phase 2:**

- Same content moderation API on avatar uploads at upload time

---

## Accessibility

Every image needs alt text. This is non-negotiable per the WCAG 2.2 AA
commitment (D034 in decision log).

### Alt text sources

| Image source              | Alt text source                                                           |
| ------------------------- | ------------------------------------------------------------------------- |
| Member avatar             | "Profile photo of [displayName]"                                          |
| Generated initials avatar | "Initials avatar for [displayName]"                                       |
| og:image scraped from URL | Try `og:image:alt`, fallback to `og:title`, then "[domain] preview image" |
| Member-uploaded post hero | Member provides alt at upload time (composer field)                       |
| Image bank item           | Curated alt text required at curation                                     |
| Group logo                | "Logo for [group name]"                                                   |
| Coordinator group logo    | "Logo for [external group name]"                                          |
| Type-default placeholder  | "Placeholder image for [post type] post"                                  |

### What we ban

- Empty alt text (`alt=""` is for decorative images only — never our
  case)
- "Image" / "Photo" as alt (no information)
- The image's filename as alt (e.g., "IMG_4839.jpg" — useless to screen
  readers)

### Where alt is checked

- Composer enforces alt text on member-uploaded images
- Image bank requires curators to set alt at curation
- Reviewer checklist (per api-contract-discipline.md and admin-surface.md)
  includes "alt text present and meaningful"

### Scrubbing existing alts

Auto-pulled og:image alts can be poor (sites don't always set good ones).
A periodic admin task: review the gallery of recent posts, fix any
poor alts. Phase 1.5 enhancement.

---

## Storage and serving

### Object storage choice

**Default for MVP:** Vercel Blob (if hosting on Vercel) or AWS S3.
Cost-effective for our scale. CDN-fronted automatically.

Alternatives evaluated:

- Cloudflare R2 — cheap, no egress fees; consider if costs grow
- Self-hosted (MinIO) — operational overhead too high for MVP

### Serving via CDN

All image URLs are served via a CDN with edge caching:

- Avatars: 24-hour TTL (members update occasionally)
- Post heroes: 1-year TTL (immutable; content-hash URLs)
- og:image cards: 24-hour TTL (might regenerate if post body changes)
- Image bank items: 1-year TTL (immutable; new versions get new URLs)

### Privacy

- All image URLs are public (no signed URLs in MVP)
- Sensitive context: a private post's hero image is also public-readable
  via its URL — this is a known limitation
- If true privacy needed, signed URLs with short expiry — Phase 2 if
  ever

---

## Schema summary (for ERD reference)

Across slices, the image-related schema:

**Slice 1 (User):**

- `User.avatarUrl?`
- `User.avatarUploadedAt?`

**Slice 1.5 (Groups):**

- `Group.logoUrl?`

**Slice 2 (Post):**

- `Post.heroImageUrl?`
- `Post.heroImageSource` (enum)
- `Post.heroImageOriginalUrl?`
- `Post.heroImageAltText?`
- `Post.heroImageStatus` (enum)
- `Post.ogImageUrl?` (Tier 2 cached card URL)
- `Post.ogImageStatus` (enum)
- `Post.ogImageGeneratedAt?`

**Phase 1.5 (CoordinatorGroup — already in admin-surface.md):**

- `CoordinatorGroup.logoUrl?`

**Phase 1.5 (ImageBankItem):**

- New table per spec above

---

## What this doc does NOT cover

(The pattern — naming gaps explicitly.)

1. **Image upload UX.** Drag-and-drop, paste-from-clipboard, mobile camera
   integration. Implementation detail, specified per Build Unit.
2. **Image editing in the composer.** Cropping, filters, captions on
   images. Out of MVP scope; relies on upstream tools.
3. **Animated images (GIFs, videos as posts).** Phase 3.
4. **Image search via similarity.** "Find images like this." Phase 3.
5. **Image collections / folders.** Members curating their own image
   library. Phase 3.
6. **Watermarking.** Adding GPS Action branding to all uploaded images.
   Phase 2 if needed for attribution.
7. **EXIF stripping.** Removing metadata (location data, camera info)
   from uploaded images. Should be done at MVP for privacy. Implementation
   detail; flagged here so it's not forgotten.
8. **Right-to-be-forgotten for images.** When a member is deleted,
   what happens to their uploaded images? GDPR concern; needs a deletion
   procedure. Documented in audit-log spec.
9. **Image-only posts.** A post that's just an image with no text.
   Possible; check composer requirements when post-creation-flow.md is
   built.
10. **Per-platform aspect ratio optimisation.** Different sizes for
    Instagram (1:1, 4:5) vs X (16:9) vs Facebook (varied). Phase 2.

---

## What lands in MVP

**MVP day 1:**

- Member avatar upload + initials placeholder
- og:image scraping from URLs in posts
- 5 type-default placeholder hero images
- Tier 1 og:image for outbound shares (pulled-through or static)
- EXIF stripping on avatar uploads
- Alt text auto-generated for scraped images, member-supplied for
  avatars
- Object storage + CDN serving

**Phase 1.5 (a few weeks in):**

- Group logos
- Coordinator group logos
- Curated image bank with admin browse/pick UI
- Tier 2 generated og:image cards
- Bank item submission queue (member-submitted)

**Phase 2:**

- Member-uploaded post hero images
- Content moderation API integration
- Member settings for "show preview images" toggle
- Post-level admin override for hero/og:image
- Watermarking if needed

**Phase 3:**

- AI-generated images
- Animated content
- Branded image templates
- Image collections
