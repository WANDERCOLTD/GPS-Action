/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Kind-specific publish-modal action for `tick_or_cross`. Wraps the
 * pre-existing GPS-Network handoff flow that previously lived in
 * `<SendToNetworkConfirm />` (BU-tick-or-cross / D069):
 *
 *   1. Format the channel message via `networkChannelMessage`
 *   2. Copy it to the clipboard (best-effort; the modal renders the
 *      message verbatim as a fallback if clipboard access fails)
 *   3. Open the WhatsApp channel URL in a new tab
 *   4. Defer the "Did you send it?" confirm-back step to the modal via
 *      `ctx.onConfirmStep`, which calls `onMarkSharedToNetwork` if the
 *      user confirms
 *
 * The "Did you send it?" step lives on the modal side (not in this
 * handler) so handlers stay UI-free — the registry contract is "do the
 * work, hand any follow-up UI back to the caller".
 */

import { Send } from 'lucide-react';
import { networkChannelMessage } from '../share/network-channel-message';
import type { PostKindAction } from './types';

const SLUG = 'share_to_gps_whatsapp';

export const shareToGpsWhatsappAction: PostKindAction = {
  slug: SLUG,
  label: (post) =>
    post.signal === 'remove'
      ? 'Post & flag on ❌ on GPS WhatsApp'
      : 'Post & share to ✅ on GPS WhatsApp',
  icon: Send,
  primary: true,
  handler: async (post, ctx) => {
    if (post.signal === null) {
      throw new Error(`${SLUG}: post.signal must be set on a tick_or_cross post`);
    }
    if (!ctx.channelUrl) {
      throw new Error(`${SLUG}: ctx.channelUrl is required`);
    }

    const message = networkChannelMessage({
      signal: post.signal,
      title: post.title,
      body: post.body,
      postUrl: `${stripTrailingSlash(ctx.originUrl)}/post/${post.id}`,
    });

    await tryWriteClipboard(message);

    if (typeof window !== 'undefined') {
      window.open(ctx.channelUrl, '_blank', 'noopener,noreferrer');
    }

    if (ctx.onConfirmStep && ctx.onMarkSharedToNetwork) {
      const markShared = ctx.onMarkSharedToNetwork;
      ctx.onConfirmStep('Did you send it?', () => markShared(post.id));
    }
  },
};

async function tryWriteClipboard(message: string): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const api = navigator.clipboard;
  if (!api?.writeText) return;
  try {
    await api.writeText(message);
  } catch {
    // Modal renders the message verbatim, so a clipboard failure
    // degrades to "select-and-copy manually" rather than data loss.
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
