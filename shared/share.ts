/**
 * @build-unit BU-spread-polish-responsive
 * @spec build/session-briefs/bu-spread-polish-responsive.md
 *
 * `Shareable` — the unified payload for the share-strip components
 * (`PostShareGroup`, `WhatsAppShareButton`, `SecondaryCtaRail`).
 *
 * The same UI ships shares for two distinct entity surfaces:
 *
 *   1. **Posts** — authored content. `source = { type: 'post', postId }`.
 *      Sharing fires analytics through the existing `pingShareIntent`
 *      (legacy `postId` shape).
 *   2. **Gallery tiles** — deduped URLs from the WhatsApp network
 *      feed. `source = { type: 'link-preview', normalizedUrl }`.
 *      Analytics for these is deferred (no `share_event` extension in
 *      this PR — gallery shares are silent until a follow-up BU adds
 *      `link_preview` to `ShareTargetType`).
 *
 * The component layer reads `shareable.url`, `.title`, `.body` to
 * compose the WhatsApp / X / Instagram / Facebook share URLs. The
 * `source` discriminator only controls analytics — same UI either way.
 */

export interface PostShareSource {
  readonly type: 'post';
  readonly postId: string;
}

export interface LinkPreviewShareSource {
  readonly type: 'link-preview';
  /** Canonical normalised URL — stable join key into LinkPreview. */
  readonly normalizedUrl: string;
}

export type ShareableSource = PostShareSource | LinkPreviewShareSource;

export interface Shareable {
  /**
   * The URL the user is sharing onward. For posts this is the
   * post's deep link (e.g. `/post/<id>`); for gallery tiles it's
   * the original article URL.
   */
  readonly url: string;
  readonly title: string;
  /** Optional body — used in the WhatsApp message text. */
  readonly body?: string;
  readonly source: ShareableSource;
}
