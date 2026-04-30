/**
 * @build-unit BU-link-first-composer
 * @spec build/session-briefs/bu-link-first-composer.md
 *
 * Pure module — no React. Single chokepoint for clipboard-read,
 * URL-vs-text detection, and compose-page navigation. Both the
 * split-FAB paste shortcut and the starter-card "📋 Paste" button
 * route through here so behaviour cannot drift between the two
 * surfaces.
 *
 * Lives under /components so view-side callers can import without
 * crossing layer boundaries; the only cross-layer dependency is
 * `@/shared/url-detect`, which is allowed.
 */

import { normalizeUrl } from '@/shared/url-detect';

const TITLE_MAX = 200;

export type ContinuePayload = { kind: 'url' | 'text'; value: string };

export type ClipboardOutcome = 'success' | 'empty' | 'denied' | 'unsupported';

export type ClipboardReadResult =
  | { outcome: 'success'; text: string }
  | { outcome: Exclude<ClipboardOutcome, 'success'> };

export interface RouterLike {
  push: (href: string) => void;
}

export function payloadFromInput(input: string): ContinuePayload | null {
  const detection = normalizeUrl(input);
  if (detection.kind === 'url') {
    return { kind: 'url', value: detection.url };
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  return { kind: 'text', value: trimmed };
}

export function buildComposeHref(payload: ContinuePayload): string {
  if (payload.kind === 'url') {
    return `/compose?linkUrl=${encodeURIComponent(payload.value)}`;
  }
  const clamped = payload.value.slice(0, TITLE_MAX);
  return `/compose?title=${encodeURIComponent(clamped)}`;
}

/**
 * Same as buildComposeHref but with an `intent` slug pinned. Used by
 * the unified FAB sheet where the member picks a kind tile and any
 * pasted/typed input rides along as a prefill.
 */
export function buildComposeHrefWithIntent(
  intent: string,
  payload: ContinuePayload | null,
): string {
  const params = new URLSearchParams();
  params.set('intent', intent);
  if (payload?.kind === 'url') {
    params.set('linkUrl', payload.value);
  } else if (payload?.kind === 'text') {
    params.set('title', payload.value.slice(0, TITLE_MAX));
  }
  return `/compose?${params.toString()}`;
}

export async function readClipboardForFill(): Promise<ClipboardReadResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return { outcome: 'unsupported' };
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) return { outcome: 'empty' };
    return { outcome: 'success', text };
  } catch {
    return { outcome: 'denied' };
  }
}

export async function readClipboardAndContinue(router: RouterLike): Promise<ClipboardOutcome> {
  const result = await readClipboardForFill();
  if (result.outcome !== 'success') return result.outcome;
  const payload = payloadFromInput(result.text);
  if (!payload) return 'empty';
  router.push(buildComposeHref(payload));
  return 'success';
}
