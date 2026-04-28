/**
 * @build-unit BU-link-first-composer
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Detect whether a member-pasted (or typed) string is a URL or free-form text,
 * and normalize the URL form to a canonical https-prefixed shape.
 *
 * The FAB starter card and every URL form field route input through here so
 * members can type `www.example.com` or `example.co.uk` without the
 * https-required gate slamming closed in their face.
 *
 * Hostname validation is delegated to the Public Suffix List (`psl`) so we
 * recognise the long tail of real TLDs (`.co.uk`, `.museum`, new gTLDs) without
 * a homegrown regex that drifts.
 *
 * IP literals and bare hostnames (e.g. `localhost`) are deliberately treated as
 * text — those are infrastructure addresses, not member-shareable links.
 */

import psl from 'psl';

export type NormalizedInput = { kind: 'url'; url: string } | { kind: 'text' };

const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;
const IPV4_LITERAL = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function normalizeUrl(input: string): NormalizedInput {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'text' };

  const firstLine = (trimmed.split(/\r?\n/)[0] ?? '').trim();
  if (!firstLine) return { kind: 'text' };

  // A URL token contains no internal whitespace — anything with a space in
  // the first line is prose, not a link.
  if (/\s/.test(firstLine)) return { kind: 'text' };

  const candidate = firstLine.replace(TRAILING_PUNCTUATION, '');
  if (!candidate) return { kind: 'text' };

  if (/^https?:\/\//i.test(candidate)) {
    return parseAbsoluteUrl(candidate);
  }

  return parseBareHostUrl(candidate);
}

function parseAbsoluteUrl(candidate: string): NormalizedInput {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { kind: 'text' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { kind: 'text' };
  if (IPV4_LITERAL.test(host)) return { kind: 'text' };
  if (!psl.isValid(host)) return { kind: 'text' };
  return { kind: 'url', url: candidate };
}

function parseBareHostUrl(candidate: string): NormalizedInput {
  const pathStart = candidate.search(/[/?#]/);
  const hostPart = pathStart === -1 ? candidate : candidate.slice(0, pathStart);
  const hostname = (hostPart.split(':')[0] ?? '').toLowerCase();

  if (!hostname) return { kind: 'text' };
  if (IPV4_LITERAL.test(hostname)) return { kind: 'text' };
  if (!hostname.includes('.')) return { kind: 'text' };
  if (!psl.isValid(hostname)) return { kind: 'text' };

  const url = `https://${candidate}`;
  try {
    new URL(url);
  } catch {
    return { kind: 'text' };
  }
  return { kind: 'url', url };
}
