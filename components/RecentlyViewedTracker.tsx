'use client';

/**
 * @build-unit BU-search-surface
 * @spec architecture/decision-log.md (D078 §8)
 *
 * Records a post visit in `localStorage` so it shows up in the
 * "Recently viewed" zero-state on `/search`. Mounted on
 * `/post/[id]/page.tsx`. Fire-and-forget — quota / privacy-mode errors
 * are swallowed inside the helper.
 *
 * `useEffect` keeps the write strictly client-side: SSR renders the
 * empty list, the client hydrates and writes after mount. No DOM
 * output — this is a side-effect-only component.
 */

import { useEffect } from 'react';
import { recordRecentlyViewed } from '@/components/recently-viewed-posts';

interface RecentlyViewedTrackerProps {
  postId: string;
  postLabel: string;
}

export function RecentlyViewedTracker({ postId, postLabel }: RecentlyViewedTrackerProps) {
  useEffect(() => {
    recordRecentlyViewed({ id: postId, label: postLabel });
  }, [postId, postLabel]);
  return null;
}
