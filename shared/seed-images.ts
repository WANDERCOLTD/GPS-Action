/**
 * @build-unit BU-post-hero-demo
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @adr D064
 *
 * Demo-only allow-list of hero images for `<HeroImagePicker>`.
 *
 * Phase 2 BU-image replaces this with real upload + S3 + moderation;
 * this constant disappears at that point. Until then it is the canonical
 * source of truth: composer reads it to render the picker, and the
 * server-side validator refines `heroImageUrl` against `allowedHeroImageUrls`
 * to block any URL that didn't come from the picker.
 *
 * URLs are root-relative paths served from `public/seed-images/` by Next.js
 * static-asset routing.
 */
export type SeedHeroImage = {
  readonly url: string;
  readonly alt: string;
};

export const SEED_HERO_IMAGES: readonly SeedHeroImage[] = [
  { url: '/seed-images/01.svg', alt: 'Protest march placeholder' },
  { url: '/seed-images/02.svg', alt: 'Banner rally placeholder' },
  { url: '/seed-images/03.svg', alt: 'Letter writing placeholder' },
  { url: '/seed-images/04.svg', alt: 'Community gathering placeholder' },
  { url: '/seed-images/05.svg', alt: 'Petition placeholder' },
  { url: '/seed-images/06.svg', alt: 'Community meeting placeholder' },
  { url: '/seed-images/07.svg', alt: 'Vigil placeholder' },
  { url: '/seed-images/08.svg', alt: 'Direct action placeholder' },
] as const;

export const allowedHeroImageUrls: ReadonlySet<string> = new Set(
  SEED_HERO_IMAGES.map((img) => img.url),
);

export function isAllowedHeroImageUrl(url: string): boolean {
  return allowedHeroImageUrls.has(url);
}
