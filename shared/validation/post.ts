/**
 * @build-unit BU-composer
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048)
 *
 * Zod validation schemas for post creation. AM URL domain allowlist
 * is env-configurable via ACTIVIST_MAILER_ALLOWED_DOMAINS.
 */

import { z } from 'zod';

const ALLOWED_DOMAINS = (process.env.ACTIVIST_MAILER_ALLOWED_DOMAINS ?? 'activistmailer.com')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const activistMailerUrlSchema = z
  .string()
  .optional()
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
  );

export const postCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().min(10).max(10000),
  activistMailerUrl: activistMailerUrlSchema,
  visibility: z.enum(['public', 'authenticated_only']).default('public'),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
