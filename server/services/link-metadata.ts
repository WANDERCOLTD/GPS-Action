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
  /**
   * Resolved absolute URL of the page's favicon. Used as a small inline
   * decoration in `LinkPreviewCard`'s site row when no `og:image` is
   * available, so cards with no hero collapse to text-with-icon rather
   * than a blank grey block. Null when neither a `<link rel="icon">` nor
   * a default `/favicon.ico` could be derived.
   */
  faviconUrl: string | null;
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
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/**
 * Decode HTML entities found in OG / meta content. Handles three forms:
 *
 *   - Named refs: `&amp;` `&quot;` `&lt;` … (limited common set —
 *     enough for OG payloads in the wild; not a full HTML5 entity table).
 *   - Decimal numeric refs: `&#8217;` → ’ (right single quote).
 *   - Hex numeric refs: `&#xb7;` → · (middle dot), `&#x2019;` → ’.
 *
 * Facebook in particular serves OG metadata with numeric refs
 * pre-encoded for raw inclusion in HTML; without a decode pass those
 * surface visibly on the rendered card (e.g. "455K views &#xb7; 30K
 * reactions"). Unknown / malformed refs pass through unchanged
 * rather than throwing — preview is decorative, never load-bearing.
 */
function decodeEntities(input: string): string {
  return input
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));/gi, (match, hex, dec, named) => {
      if (hex !== undefined) {
        const cp = Number.parseInt(hex, 16);
        return Number.isFinite(cp) ? safeFromCodePoint(cp, match) : match;
      }
      if (dec !== undefined) {
        const cp = Number.parseInt(dec, 10);
        return Number.isFinite(cp) ? safeFromCodePoint(cp, match) : match;
      }
      if (named !== undefined) {
        return ENTITY_MAP[named.toLowerCase()] ?? match;
      }
      return match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Guard against out-of-range codepoints from malformed input —
 * `String.fromCodePoint` throws RangeError on > 0x10FFFF or
 * non-finite values, which would propagate out of the metadata
 * extractor and break the preview path. Return the original ref
 * unchanged on failure.
 */
function safeFromCodePoint(cp: number, fallback: string): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return fallback;
  }
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

  const faviconUrl = extractFavicon(head, finalUrl);

  return { title, description, imageUrl, siteName, faviconUrl };
}

/**
 * Pull the page's favicon from `<link rel="icon">` /
 * `<link rel="shortcut icon">` / `<link rel="apple-touch-icon">`.
 * Prefer the entry with the largest declared `sizes`; fall back to
 * the document's `/favicon.ico` if no `<link>` is found. Resolved to
 * an absolute URL against the final (post-redirect) page URL.
 *
 * Tolerates attribute order swap (`href` before `rel`) and `rel`
 * values with multiple tokens (`rel="icon shortcut"`). Returns null
 * only when even the `/favicon.ico` fallback can't be constructed
 * (invalid page URL).
 */
function extractFavicon(head: string, finalUrl: string): string | null {
  const re = /<link\b[^>]*>/gi;
  let best: { href: string; score: number } | null = null;
  for (const match of head.matchAll(re)) {
    const tag = match[0];
    const rel = attr(tag, 'rel');
    if (!rel) continue;
    if (!/(?:^|\s)(?:icon|shortcut\s+icon|apple-touch-icon)(?:\s|$)/i.test(rel)) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    // Score = largest dimension declared in sizes="32x32" / "any" /
    // missing. apple-touch-icon defaults to 180 by spec; treat as a
    // moderate boost over the unspecified shortcut icon (often 16/32).
    const sizes = attr(tag, 'sizes');
    let score = 0;
    if (sizes) {
      if (/any/i.test(sizes)) score = 9999;
      else {
        const dim = sizes.match(/(\d+)\s*[x×]\s*(\d+)/i);
        if (dim) score = Math.max(Number(dim[1]), Number(dim[2]));
      }
    } else if (/apple-touch-icon/i.test(rel)) {
      score = 180;
    }
    if (!best || score > best.score) best = { href, score };
  }
  if (best) return resolveUrl(best.href, finalUrl);
  try {
    return new URL('/favicon.ico', finalUrl).toString();
  } catch {
    return null;
  }
}

/** Read a single attribute value out of a tag string. Tolerates single/double quotes. */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = tag.match(re);
  return m?.[1] ? decodeEntities(m[1]) : null;
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
