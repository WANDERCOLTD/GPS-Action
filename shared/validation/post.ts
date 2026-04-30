/**
 * @build-unit BU-composer BU-link-share BU-fab-intent-picker BU-post-hero-demo BU-tick-or-cross BU-link-first-composer BU-event-time
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048, D060, D062, D064, D069, D073)
 * @spec build/session-briefs/bu-link-first-composer.md
 * @spec docs/adrs/0001-post-event-time-fields.md
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
 *
 * BU-event-time / D073: structured event-time fields land here.
 * eventAt / eventEndsAt accept ISO strings or Date objects; both
 * coerce to Date and reject invalid input. The cross-field invariant
 * `eventEndsAt >= eventAt` runs as a `.superRefine` on the parent
 * schema so the error attaches to `eventEndsAt`. Optional for all
 * kinds — composer nudges, server does not block (per ADR-0001).
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

// BU-event-time / D073. Accept ISO strings (the typical FormData / JSON
// shape), Date instances (when called from server-side seed / test
// scripts), `null` (explicit clear on the edit surface), or
// `undefined` (no value). The transform PRESERVES the `null vs
// undefined` distinction:
//
//  - `undefined` → "field absent" → service skips it on update
//  - `null`      → "explicit clear" → service writes NULL on update
//  - empty string → undefined (round-trips empty FormData to absent)
//  - ISO string / Date → parsed to a Date
//
// Invalid date strings produce an `Invalid Date` which the
// downstream `.refine` rejects with a friendly message (rather than
// throwing inside the transform, which Zod surfaces as an
// unrecoverable system error).
const eventDateTimeSchema = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((val): Date | null | undefined => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return undefined;
      return new Date(trimmed);
    }
    return undefined;
  })
  .pipe(
    z
      .date()
      .nullable()
      .optional()
      .refine((d) => d === undefined || d === null || !isNaN(d.getTime()), {
        message: 'must be a valid date-time',
      }),
  );

export const postCreateSchema = z
  .object({
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
    // D075 — Activist Mailer flag. Persisted on Post; auto-set at submit
    // by the form when the linkUrl matches an AM domain, manually
    // overridable by the author.
    isActivistMailer: z.boolean().optional(),
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
    // BU-event-time / D073. Structured event-time fields. Optional for
    // all kinds — composer nudges (shows pickers when the kind is
    // time-bearing per kindIsTimeBearing) but the server does not
    // block submission when absent. UTC at the wire boundary; the
    // composer + edit page convert from Europe/London via
    // shared/format-event-time.ts.
    eventAt: eventDateTimeSchema,
    eventEndsAt: eventDateTimeSchema,
    locationText: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    // BU-event-time / D073. Cross-field invariant: when both timestamps
    // are set, the end must be at-or-after the start. Attaches the
    // error to `eventEndsAt` so the composer can render an inline
    // message under the end-time field.
    if (val.eventAt && val.eventEndsAt && val.eventEndsAt < val.eventAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndsAt'],
        message: 'End time must be the same as or after the start time',
      });
    }
  });

export type PostCreateInput = z.infer<typeof postCreateSchema>;

/**
 * BU-event-time / D073. Update-post input — the existing fields plus
 * the `id` of the post being edited. All other fields stay optional;
 * an `undefined` value means "do not change". An explicit `null` for
 * a nullable field (linkUrl, eventAt, etc.) means "clear it". The
 * service inspects `Object.prototype.hasOwnProperty.call(input, key)`
 * to distinguish absent from null.
 */
export const postUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(3).max(200).optional(),
    body: z.string().min(10).max(10000).optional(),
    activistMailerUrl: activistMailerUrlSchema,
    visibility: z.enum(['public', 'authenticated_only']).optional(),
    linkUrl: httpUrlSchema,
    linkTitle: z.string().trim().max(200).optional(),
    linkDescription: z.string().trim().max(500).optional(),
    linkImageUrl: httpUrlSchema,
    linkSiteName: z.string().trim().max(100).optional(),
    kindId: z.string().trim().min(1).optional(),
    urgency: z.boolean().optional(),
    heroImageUrl: z
      .string()
      .nullable()
      .optional()
      .refine((val) => val == null || val === '' || isAllowedHeroImageUrl(val), {
        message: 'heroImageUrl must be one of the seeded demo images',
      }),
    signal: z.enum(['promote', 'remove']).optional(),
    eventAt: eventDateTimeSchema,
    eventEndsAt: eventDateTimeSchema,
    locationText: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.eventAt && val.eventEndsAt && val.eventEndsAt < val.eventAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndsAt'],
        message: 'End time must be the same as or after the start time',
      });
    }
  });

export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
