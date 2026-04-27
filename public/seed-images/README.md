# Seed images — BU-post-hero-demo (D064)

Demo-only image set for `<HeroImagePicker>` in BU-post-hero-demo.

## What's here

8 SVG placeholders at 16:9 (1600×900 viewBox), each ≤6 KB. They
render recognizable scenes (silhouettes, banners, candles, stamps,
typography) so the feed doesn't look empty before real photos drop
in.

| File     | Theme                     | Scene                                                    |
| -------- | ------------------------- | -------------------------------------------------------- |
| `01.svg` | Protest march             | Crowd silhouette + raised banners + sun + raised fist    |
| `02.svg` | Banner rally              | "RAISE YOUR VOICE" banner held by crowd                  |
| `03.svg` | Letter writing            | Letter to MP, fountain pen, opening line + ruled lines   |
| `04.svg` | Community gathering       | Dense ring of figures + golden star centred              |
| `05.svg` | Petition / signatures     | Petition document with handwritten signatures + pen      |
| `06.svg` | Community meeting         | Ring of figures around a table with papers               |
| `07.svg` | Vigil / remembrance       | Row of nine candles with flames against a deep night sky |
| `08.svg` | Direct action / megaphone | Bullhorn + "ACT NOW" + emphasis lines and stars          |

## Shopping list — real photos to replace these

When you're ready to swap in real photos, the list below tells you
exactly what to source. Drop each photo into this directory using
the **target filename** column, then **no code changes needed** —
the URLs in `shared/seed-images.ts` already reference the right
slot. (You may want to update the `alt` strings there to match the
specific image, e.g. swap "Protest march placeholder" for
"Climate march, Westminster, October 2024".)

### File specs (apply to every photo)

- **Format:** JPG (or WebP if your hosting supports it; SVG is fine
  too if it's a real photographic SVG, but raster is what we expect).
- **Dimensions:** ≥ 1600 px on the long edge. Aspect ratio doesn't
  need to be exactly 16:9 — the card uses `object-fit: cover`, so
  anything wide-ish (3:2, 4:3, 16:9, 16:10) works. Avoid portrait.
- **File size:** target ≤ 400 KB after compression. Use TinyPNG /
  Squoosh if needed.
- **License:** CC0, Public Domain, or "free to use" royalty-free.
  Avoid anything with attribution requirements unless you're
  comfortable maintaining the attribution table below.
- **Identifiability:** prefer photos where individual faces aren't
  the focal point (silhouettes, hands, banners, scenes). The demo
  set is for "this is roughly what an action looks like" — not for
  representing specific named individuals.
- **Tone:** activist-friendly, dignified, real. Avoid stock-photo
  cheesiness (perfectly arranged people grinning at the camera).

### Where to source

| Source            | License | Search hint                                       |
| ----------------- | ------- | ------------------------------------------------- |
| Unsplash          | CC0     | https://unsplash.com — search by theme term below |
| Pexels            | Free    | https://pexels.com — same                         |
| Pixabay           | Free    | https://pixabay.com — same                        |
| WikiMedia Commons | varied  | Filter to CC0 / PD only                           |

### Per-image search terms

| Target filename | Theme               | Suggested search terms                                                 |
| --------------- | ------------------- | ---------------------------------------------------------------------- |
| `01.jpg`        | Protest march       | "protest march", "demonstration crowd", "raised banners street"        |
| `02.jpg`        | Banner rally        | "rally banner", "demonstration sign", "crowd banner held high"         |
| `03.jpg`        | Letter writing      | "writing letter", "handwriting pen paper", "fountain pen letter"       |
| `04.jpg`        | Community gathering | "community circle", "people gathering hands", "diverse group together" |
| `05.jpg`        | Petition            | "petition signature", "signing document", "clipboard signatures"       |
| `06.jpg`        | Community meeting   | "community meeting", "group around table discussion", "town hall"      |
| `07.jpg`        | Vigil / remembrance | "candlelight vigil", "candles night memorial", "vigil flames"          |
| `08.jpg`        | Direct action       | "megaphone protest", "bullhorn rally", "loudspeaker activist"          |

### After you drop the JPGs in

1. Place each photo in this directory using the matching filename
   (`01.jpg` → `08.jpg`).
2. **Delete the matching `0N.svg`** so there's no ambiguity.
3. Edit `shared/seed-images.ts`:
   - Change each `url: '/seed-images/01.svg'` → `url: '/seed-images/01.jpg'`
   - Update each `alt:` string to describe the actual photo
4. Fill in the attribution table in this README (rows already
   sketched below).
5. Re-seed if you want fresh posts to pick the new images:
   `npx prisma db seed`.

That's it — no code changes elsewhere. The picker, validator, and
rendering paths are file-extension-agnostic.

### Attribution table (fill in when real photos land)

| File     | Photographer | Source URL | License |
| -------- | ------------ | ---------- | ------- |
| `01.jpg` | _TBD_        |            |         |
| `02.jpg` | _TBD_        |            |         |
| `03.jpg` | _TBD_        |            |         |
| `04.jpg` | _TBD_        |            |         |
| `05.jpg` | _TBD_        |            |         |
| `06.jpg` | _TBD_        |            |         |
| `07.jpg` | _TBD_        |            |         |
| `08.jpg` | _TBD_        |            |         |

## License (current SVG state)

These SVGs are generated content with no upstream provenance. Treat
as project-internal CC0.

## Lifecycle

Demo only. When Phase 2 BU-image lands real upload + S3 + moderation,
this directory and `shared/seed-images.ts` are removed. The Post
model's `heroImageUrl` field survives the swap (only its value source
changes).
