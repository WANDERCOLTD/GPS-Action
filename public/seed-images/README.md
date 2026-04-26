# Seed images — BU-post-hero-demo (D064)

Demo-only image set for `<HeroImagePicker>` in BU-post-hero-demo.

## What's here

8 SVG placeholder images at 16:9 (1600×900 viewBox), each ≤2 KB:

| File     | Theme               | Gradient         |
| -------- | ------------------- | ---------------- |
| `01.svg` | Protest march       | red → orange     |
| `02.svg` | Banner rally        | teal → amber     |
| `03.svg` | Letter writing      | navy → blue      |
| `04.svg` | Community gathering | violet → magenta |
| `05.svg` | Petition            | slate → grey     |
| `06.svg` | Community meeting   | orange → yellow  |
| `07.svg` | Vigil               | indigo → purple  |
| `08.svg` | Direct action       | crimson → red    |

## Why SVG placeholders, not Unsplash JPGs

The brief (`docs/build/session-briefs/bu-post-hero-demo.md`) names
royalty-free Unsplash JPGs as the target. This implementation ships
SVG placeholders instead because:

1. **No external download required at build time** — placeholders are
   self-contained in the repo, no fetch step in CI.
2. **No license-attribution risk** — generated SVGs have no upstream
   attribution requirements; Unsplash CC0 still benefits from courtesy
   credit.
3. **Tiny payload** — 8 SVGs total ≈ 16 KB vs. ≈ 2-3 MB for JPGs.

Real photos can swap in by replacing each `0N.svg` with an `0N.jpg`
of matching aspect ratio and updating the URLs in
`shared/seed-images.ts`. The `<HeroImagePicker>` and rendering paths
are file-extension-agnostic.

## License

These SVGs are generated content with no upstream provenance. Treat
as project-internal CC0. When real photos replace them, this section
becomes the attribution table — one row per image, with photographer
and source URL.

## Lifecycle

Demo only. When Phase 2 BU-image lands real upload + S3 + moderation,
this directory and `shared/seed-images.ts` are removed. The Post
model's `heroImageUrl` field survives the swap (only its value source
changes).
