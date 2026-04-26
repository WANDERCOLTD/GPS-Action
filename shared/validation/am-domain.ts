/**
 * @build-unit BU-am-link-collapse
 * @spec build/session-briefs/bu-am-link-collapse.md
 * @spec architecture/decision-log.md (D060)
 *
 * Activist-Mailer domain detection. Pure function, no exceptions —
 * `false` on parse failure. Reuses the existing
 * `ACTIVIST_MAILER_ALLOWED_DOMAINS` env list so the validation
 * layer (post.ts) and the render layer (LinkPreviewCard) agree on
 * what counts as an AM URL.
 *
 * Subdomain match is permitted: `mail.activistmailer.com` matches.
 */

const ALLOWED_DOMAINS: ReadonlyArray<string> = (
  process.env.ACTIVIST_MAILER_ALLOWED_DOMAINS ?? 'activistmailer.com'
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isActivistMailerDomain(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}
