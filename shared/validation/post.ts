/**
 * @build-unit BU-composer BU-link-share BU-fab-intent-picker BU-post-hero-demo BU-tick-or-cross BU-link-first-composer
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048, D060, D062, D064, D069)
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Zod validation schemas for post creation. AM URL domain allowlist
 * is env-configurable via ACTIVIST_MAILER_ALLOWED_DOMAINS. Link-share
 * fields (D060) are optional; URL fields enforce http(s) protocols.
 * kind (D062) is a free-form string label written by the intent picker.
 * heroImageUrl (D064) is constrained to the seeded demo bucket.
 * signal (D069) carries the author's amplify/flag choice for the
 * `tick_or_cross` kind; the service enforces the kind-coupling invariant.
 *
 * BU-link-first-composer: URL fields run inputs through normalizeUrl()
 * as a preprocessor so members can type `www.example.com` or
 * `example.co.uk` and the schema treats them as valid https URLs.
 * Inputs that fail URL detection (free-form text) pass through
 * unchanged — the existing refinement still rejects them with the
 * pre-existing "URL must be a valid http(s) URL" message.
 */

import { z } from 'zod';

import { isAllowedHeroImageUrl } from '../seed-images';
import { normalizeUrl } from '../url-detect';

function normalizeIfUrl(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return val;
  const result = normalizeUrl(trimmed);
  return result.kind === 'url' ? result.url : val;
}

const ALLOWED_DOMAINS = (process.env.ACTIVIST_MAILER_ALLOWED_DOMAINS ?? 'activistmailer.com')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const activistMailerUrlSchema = z
  .string()
  .transform(normalizeIfUrl)
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      try {
        const url = new URL(val);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase();
        return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
      } catch {
        return false;
      }
    },
    {
      message: 'Activist Mailer URL must be https and from an allowed domain',
    },
  )
  .optional();

const httpUrlSchema = z
  .string()
  .transform(normalizeIfUrl)
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      try {
        const url = new URL(val);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'URL must be a valid http or https URL' },
  )
  .optional();

export const postCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().min(10).max(10000),
  activistMailerUrl: activistMailerUrlSchema,
  visibility: z.enum(['public', 'authenticated_only']).default('public'),
  // Link-share preview card fields (D060). All optional.
  linkUrl: httpUrlSchema,
  linkTitle: z.string().trim().max(200).optional(),
  linkDescription: z.string().trim().max(500).optional(),
  linkImageUrl: httpUrlSchema,
  linkSiteName: z.string().trim().max(100).optional(),
  // Intent kind FK (D062 revised). UUID of a PostKind row. Composer
  // resolves the slug → id before submit; the API takes the id directly.
  kindId: z.string().trim().min(1).optional(),
  // Alert flag (D062 revised). Composer enforces that this can only be
  // true when the selected PostKind has isAlertEligible=true; the
  // service double-checks at write time.
  urgency: z.boolean().optional(),
  // Hero image (BU-post-hero-demo / D064). Demo path: must be one of
  // the seeded URLs in `shared/seed-images.ts`. Phase 2 BU-image
  // replaces this allow-list with real upload validation.
  heroImageUrl: z
    .string()
    .nullable()
    .optional()
    .refine((val) => val == null || val === '' || isAllowedHeroImageUrl(val), {
      message: 'heroImageUrl must be one of the seeded demo images',
    }),
  // Amplify (✅) / flag (❌) choice for the `tick_or_cross` PostKind
  // (BU-tick-or-cross / D069). Required iff the resolved kind slug is
  // `tick_or_cross`, forbidden otherwise. The service enforces the
  // coupling at write time after resolving kindId → slug.
  signal: z.enum(['promote', 'remove']).optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
