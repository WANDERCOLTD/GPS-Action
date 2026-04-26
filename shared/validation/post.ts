/**
 * @build-unit BU-composer BU-link-share BU-fab-intent-picker
 * @spec product/post-creation-flow.md
 * @spec architecture/decision-log.md (D045, D048, D060, D062)
 *
 * Zod validation schemas for post creation. AM URL domain allowlist
 * is env-configurable via ACTIVIST_MAILER_ALLOWED_DOMAINS. Link-share
 * fields (D060) are optional; URL fields enforce http(s) protocols.
 * kind (D062) is a free-form string label written by the intent picker.
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

const httpUrlSchema = z
  .string()
  .optional()
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
  );

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
  // Intent kind label (D062). Free-form string; composer writes one of:
  // 'alert' | 'link_share' | 'call_to_action' | 'cultural' | 'outcome' | 'thought' | 'event' | 'meeting'.
  kind: z.string().trim().max(50).optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
