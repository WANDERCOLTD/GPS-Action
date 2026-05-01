/**
 * @build-unit BU-share-rail-on-detail BU-postcard-share-polish
 * @spec build/session-briefs/bu-whatsapp-share.md
 * @spec build/session-briefs/bu-postcard-share-polish.md
 *
 * The full set of share affordances for a post: WhatsApp (lead) plus
 * the X / Instagram / Facebook social rail. Used on both the PostCard
 * and the post detail page so the share group is consistent across
 * surfaces (the user requirement: "all SHARE options from post card
 * MUST APPEAR in detail pages").
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
 *                    author row and the primary CTA on the detail page.
 *
 * "WhatsApp larger and separate but close to the social shares" — the
 * WA button is sized and styled to read as the lead, while still
 * sitting adjacent to the X/IG/FB rail so the share group reads as
 * one unit.
 */

import type { FC } from 'react';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';
import { SecondaryCtaRail } from '@/components/SecondaryCtaRail';

interface PostShareGroupProps {
  postId: string;
  postTitle: string;
  postBody: string;
  variant: 'card-rail' | 'detail-bar';
}

export const PostShareGroup: FC<PostShareGroupProps> = ({
  postId,
  postTitle,
  postBody,
  variant,
}) => {
  const isDetail = variant === 'detail-bar';

  return (
    <div
      data-testid="post-share-group"
      data-variant={variant}
      style={{
        display: 'flex',
        flexDirection: isDetail ? 'row' : 'column',
        alignItems: 'center',
        gap: isDetail ? 'var(--space-3)' : 'var(--space-2)',
        flexShrink: 0,
      }}
    >
      <WhatsAppShareButton
        postId={postId}
        postTitle={postTitle}
        postBody={postBody}
        variant={isDetail ? 'pill' : 'compact'}
      />
      <SecondaryCtaRail
        size={isDetail ? 'detail' : 'card'}
        layout={isDetail ? 'horizontal' : 'vertical'}
      />
    </div>
  );
};
