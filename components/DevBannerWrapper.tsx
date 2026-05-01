'use client';

/**
 * @build-unit BU-one-click-polish
 * @spec build/session-briefs/bu-one-click-polish.md
 *
 * Client wrapper that hides its children when the dev banner is
 * collapsed via `<DevBannerToggle />`. Reads the same localStorage
 * key (`gps:dev-banner-visible`) and subscribes to the toggle's
 * `gps:dev-banner-visibility-change` custom event so the strip
 * updates without a page reload.
 *
 * On the server (and the first client paint pre-hydration) it
 * renders the children visible — the default-hidden behaviour
 * applies after hydration. This avoids a server-rendered "Logged in
 * as …" strip flashing for unauthed dev viewers; the alternative
 * (default visible until proven otherwise) felt worse than the
 * brief flash for the demo path.
 */

import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { readDevBannerVisible, subscribeDevBannerVisibility } from '@/components/DevBannerToggle';

interface DevBannerWrapperProps {
  children: ReactNode;
}

export const DevBannerWrapper: FC<DevBannerWrapperProps> = ({ children }) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setVisible(readDevBannerVisible());
    setHydrated(true);
    return subscribeDevBannerVisibility(() => {
      setVisible(readDevBannerVisible());
    });
  }, []);

  // Pre-hydration: render hidden so the default-collapsed state is the
  // first paint members see. Avoids a flash of the dev strip on
  // public/demo loads.
  return (
    <div
      data-testid="dev-banner-wrapper"
      data-visible={hydrated && visible ? 'true' : 'false'}
      style={{ display: hydrated && visible ? 'block' : 'none' }}
    >
      {children}
    </div>
  );
};
