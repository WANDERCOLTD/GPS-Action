# `<HeroImagePicker />`

**Build Unit:** BU-post-hero-demo (D064)

Controlled component. Renders the seeded demo image set
(`SEED_HERO_IMAGES` from `shared/seed-images.ts`) as a 4×2 grid of
16:9 thumbnails. The member taps a thumbnail to select; tapping the
selected thumbnail again clears the selection.

## Contract

```ts
interface HeroImagePickerProps {
  value: string | null; // selected URL, null if none
  onChange: (next: string | null) => void;
  label?: string; // default: "Add a hero image (optional)"
  disabled?: boolean;
}
```

The component is fully controlled — it holds no state. The parent
form (`PostForm`) owns the selected URL.

## Behavioural notes

- Selection state is exclusive (radio group), not multi-select.
- Selected tile shows a `var(--colour-primary)` 3px ring; non-selected
  tiles dim slightly when something is selected.
- Each tile carries a static `data-testid="compose-hero-option"`,
  `data-index="0..7"`, and `data-selected="true|false"` for tests.
  (Static testid + dynamic data attribute follows the project's
  testid convention.)
- The container has `data-testid="compose-hero-picker"`.
- ARIA: `role="radiogroup"` on the container, `role="radio"` on each
  tile, `aria-checked`, and `aria-label` from `SEED_HERO_IMAGES[i].alt`.

## When to use this component

In any composer that lets a member attach a hero image to a Post.
Today: `PostForm`. Future: edit-post flow if/when that lands (parking-
lot "Composer enhancements (Phase 2+)").

## When NOT to use

- For real member upload (file input → S3). That's Phase 2 BU-image
  scope; the seeded set is an interim demo path.
- For arbitrary image-URL input. The validator only accepts URLs in
  `SEED_HERO_IMAGES`; pasting any other URL is rejected.

## Lifecycle

When Phase 2 BU-image lands, the underlying `SEED_HERO_IMAGES`
constant disappears. This component is replaced or refactored at
that point — the controlled contract (`value` / `onChange`) stays
stable, only the source set and selection UX change.
