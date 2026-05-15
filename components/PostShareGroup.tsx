/**
 * @build-unit BU-share-rail-on-detail BU-postcard-share-polish BU-spread-polish-responsive
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-postcard-share-polish.md
 * @spec build/session-briefs/bu-spread-polish-responsive.md
 *
 * The full set of share affordances for any shareable thing — a Post
 * (authored content) OR a gallery tile (deduped URL from the WhatsApp
 * network feed). Both surfaces render the same WhatsApp lead + X / IG
 * / FB social rail; the underlying `Shareable` discriminator controls
 * analytics, not appearance.
 *
 * Two layout variants:
 *   - `card-rail`  — vertical column. WhatsApp at the top (compact
 *                    circular button), socials beneath. Sits in the
 *                    PostCard's right rail. The rail itself
 *                    `align-self: flex-start` + `margin-left: auto`
 *                    so it pins flush to the card's right inner edge
 *                    instead of drifting toward centre.
 *   - `detail-bar` — horizontal row. WhatsApp on the left as a labelled
 *                    pill (the prominent lead affordance), socials to
 *                    the right as compact circles. Sits between the
 *                    author row and the primary CTA on the detail page,
 *                    AND between the spread-trace timeline and the
 *                    Open-link CTA on the gallery detail sheet.
 *
 * "WhatsApp larger and separate but close to the social shares" — the
 * WA button is sized and styled to read as the lead, while still
 * sitting adjacent to the X/IG/FB rail so the share group reads as
 * one unit.
 */

import type { FC } from 'react';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';
import { SecondaryCtaRail } from '@/components/SecondaryCtaRail';
import type { Shareable } from '@/shared/share';

interface PostShareGroupProps {
  shareable: Shareable;
  variant: 'card-rail' | 'detail-bar';
}

export const PostShareGroup: FC<PostShareGroupProps> = ({ shareable, variant }) => {
  const isDetail = variant === 'detail-bar';

  return (
    <div
      data-testid="post-share-group"
      data-variant={variant}
      data-share-source={shareable.source.type}
      style={{
        display: 'flex',
        flexDirection: isDetail ? 'row' : 'column',
        alignItems: 'center',
        gap: isDetail ? 'var(--space-3)' : 'var(--space-2)',
        flexShrink: 0,
      }}
    >
      <WhatsAppShareButton shareable={shareable} variant={isDetail ? 'pill' : 'compact'} />
      <SecondaryCtaRail
        size={isDetail ? 'detail' : 'card'}
        layout={isDetail ? 'horizontal' : 'vertical'}
      />
    </div>
  );
};

/**
 * Adapter: build a `Shareable` from a Post-like object. Posts share
 * their *deep link* (`/post/<id>`), not an external URL — the
 * WhatsApp button prepends the runtime origin at click time.
 */
export interface PostShareableInput {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export function postToShareable(post: PostShareableInput): Shareable {
  return {
    url: `/post/${post.id}`,
    title: post.title,
    body: post.body,
    source: { type: 'post', postId: post.id },
  };
}

/**
 * Adapter: build a `Shareable` from a gallery spread tile. Unlike
 * posts (whose share URL is a deep link into our own app), tiles
 * share the underlying article URL directly — no origin prepend.
 */
export interface SpreadTileShareableInput {
  readonly url: string;
  readonly title: string | null;
  readonly normalizedUrl: string;
}

export function spreadTileToShareable(tile: SpreadTileShareableInput): Shareable {
  const title = tile.title ?? domainOf(tile.url);
  return {
    url: tile.url,
    title,
    body: '',
    source: { type: 'link-preview', normalizedUrl: tile.normalizedUrl },
  };
}

function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch {
    return url;
  }
}
