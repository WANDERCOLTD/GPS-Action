/**
 * @build-unit BU-feed-card-affordances
 * @spec build/session-briefs/bu-feed-card-affordances.md
 *
 * Fetch a URL and pull OpenGraph / Twitter / HTML-title metadata from
 * its <head>. Used by the link-first compose form so a member who
 * pastes a URL gets a candidate title (and the rest of the link-card
 * preview fields) without typing anything.
 *
 * Conservative defaults: 5s timeout, 1MB cap on the body we read,
 * follow up to a small number of redirects (fetch's default), only
 * accept text/html content. Any failure returns `{ ok: false, reason }`
 * and the caller falls back to the user typing the title themselves.
 *
 * Uses a regex parser for the head — small, deterministic, no extra
 * dependency. If we ever need to handle JS-rendered metadata we'd
 * swap in a headless browser, but that's out of scope here.
 */

import { z } from 'zod';

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024; // 1MB — meta is in the first ~30KB of any page

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; GPSAction/1.0; +https://gps-action.uk) link-preview-bot',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en;q=0.9',
};

const inputSchema = z.object({
  url: z.string().url(),
});

// SSRF guard. Blocks hostnames that resolve to internal / cloud-metadata
// / link-local addresses by string match — the most common SSRF targets.
// Not a complete defence (DNS rebinding still possible if an attacker
// owns the auth domain) but combined with an auth check at the action
// layer this raises the bar to "authenticated user with their own
// domain" — out of scope for our threat model.
const BLOCKED_HOSTNAME_RE =
  /^(localhost|0(\.|$)|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|.+\.local$|^\[?(::1|fe80:|fc00:|fd00:|::ffff:)/i;

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_RE.test(hostname);
}

export interface LinkMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export type LinkMetadataResult = { ok: true; data: LinkMetadata } | { ok: false; reason: string };

export async function fetchLinkMetadata(input: { url: string }): Promise<LinkMetadataResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_url' };

  // SSRF guard at the URL layer. Reject anything pointing at internal,
  // loopback, link-local, or RFC1918 ranges before we ever open a socket.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(parsed.data.url);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, reason: 'protocol_blocked' };
  }
  if (isBlockedHostname(parsedUrl.hostname)) {
    return { ok: false, reason: 'host_blocked' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.data.url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };

    const ctype = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (!ctype.includes('html')) {
      return { ok: false, reason: 'not_html' };
    }

    const text = await readCappedBody(res, MAX_BYTES);
    if (text === null) return { ok: false, reason: 'no_body' };

    return { ok: true, data: extractMetadata(text, res.url) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.name) : 'fetch_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readCappedBody(res: Response, cap: number): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
    }
  }
  reader.cancel().catch(() => undefined);
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

function decodeEntities(input: string): string {
  return input
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull <meta property|name="X" content="Y"> by name. Tolerates
 * attribute order swap (`content` before `property|name`). Stays in
 * the <head> so we don't trip over body text.
 */
function metaContent(head: string, key: string): string | null {
  // property|name first, content second
  const re1 = new RegExp(
    `<meta\\b[^>]*?\\b(?:property|name)\\s*=\\s*["']${key}["'][^>]*?\\bcontent\\s*=\\s*["']([^"']*?)["']`,
    'i',
  );
  // content first, property|name second
  const re2 = new RegExp(
    `<meta\\b[^>]*?\\bcontent\\s*=\\s*["']([^"']*?)["'][^>]*?\\b(?:property|name)\\s*=\\s*["']${key}["']`,
    'i',
  );
  const m = head.match(re1) ?? head.match(re2);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function extractMetadata(html: string, finalUrl: string): LinkMetadata {
  const lower = html.toLowerCase();
  const headEnd = lower.indexOf('</head>');
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html.slice(0, 50_000);

  const title =
    metaContent(head, 'og:title') ?? metaContent(head, 'twitter:title') ?? matchTitleTag(head);

  const description =
    metaContent(head, 'og:description') ??
    metaContent(head, 'twitter:description') ??
    metaContent(head, 'description');

  const rawImage = metaContent(head, 'og:image') ?? metaContent(head, 'twitter:image');
  const imageUrl = rawImage ? resolveUrl(rawImage, finalUrl) : null;

  const siteName = metaContent(head, 'og:site_name') ?? hostnameFor(finalUrl);

  return { title, description, imageUrl, siteName };
}

function matchTitleTag(head: string): string | null {
  const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function resolveUrl(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function hostnameFor(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
