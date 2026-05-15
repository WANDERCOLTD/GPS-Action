/**
 * @build-unit BU-link-preview-store
 * @spec adrs/0019-link-preview-store.md
 *
 * Domain → type classification for the spread gallery's type-chip
 * filter. Pure function over the URL host; stored on
 * `LinkPreview.linkType` so type filtering is pure SQL with an
 * index, not a per-row regex.
 *
 * Buckets are empirically grounded — derived from a 500-URL sample
 * of recent `/network` content (session 2026-05-14):
 *   Social 74% · Video 13% · News 7% · Action 3% · Other 3%
 *
 * Adding a domain to a bucket is additive and non-breaking. To
 * promote a domain from "Other" to a typed bucket, drop it in the
 * appropriate set below; existing rows refresh their `linkType` on
 * their next TTL-driven re-fetch.
 */

export type LinkType = 'Social' | 'Video' | 'News' | 'Action' | 'Other';

const SOCIAL_HOSTS = new Set([
  'x.com',
  'twitter.com',
  't.co',
  'instagram.com',
  'facebook.com',
  'm.facebook.com',
  'fb.com',
  'threads.net',
  'threads.com',
  'bsky.app',
  'mastodon.social',
  'linkedin.com',
  'reddit.com',
  'old.reddit.com',
]);

const VIDEO_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'vimeo.com',
  'tiktok.com',
  'vm.tiktok.com',
]);

const NEWS_HOSTS = new Set([
  'telegraph.co.uk',
  'thejc.com',
  'jewishnews.co.uk',
  'jpost.com',
  'bbc.co.uk',
  'news.bbc.co.uk',
  'theguardian.com',
  'dailymail.com',
  'dailymail.co.uk',
  'standard.co.uk',
  'lbc.co.uk',
  'gbnews.com',
  'politicshome.com',
  'apple.news',
]);

// Substack tail — any *.substack.com is News.
const NEWS_DOMAIN_SUFFIXES = ['.substack.com'];

const ACTION_HOSTS = new Set([
  'change.org',
  '38degrees.org.uk',
  'action.38degrees.org.uk',
  'you.38degrees.org.uk',
  'petition.parliament.uk',
  'app.activistmailer.com',
  'palestinecampaign.org',
  'gofundme.com',
  'justgiving.com',
  'crowdjustice.com',
  'actionnetwork.org',
]);

function normaliseHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

export function classifyHost(host: string): LinkType {
  const h = normaliseHost(host);

  if (SOCIAL_HOSTS.has(h)) return 'Social';
  if (VIDEO_HOSTS.has(h)) return 'Video';
  if (NEWS_HOSTS.has(h)) return 'News';
  if (ACTION_HOSTS.has(h)) return 'Action';

  for (const suffix of NEWS_DOMAIN_SUFFIXES) {
    if (h.endsWith(suffix)) return 'News';
  }

  return 'Other';
}

/** Convenience: classify directly from a URL string. */
export function classifyUrl(url: string): LinkType {
  try {
    return classifyHost(new URL(url).hostname);
  } catch {
    return 'Other';
  }
}
