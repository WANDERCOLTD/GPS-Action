/**
 * @build-unit BU-demo-mode
 * @spec architecture/environments.md
 *
 * Awareness banner shown only on demo deployments (DEMO_MODE=1). Tells
 * viewers the app is a demo with seeded data so screenshots and shares
 * cannot be mistaken for real production state.
 *
 * Self-gates via isDemoMode(); the root layout always mounts it. Returns
 * null in real production and in local dev — viewers in those contexts
 * never see it.
 *
 * Non-sticky by design: lives above the sticky header so first paint is
 * unambiguous; scrolls away during use to keep the chrome light.
 */

import type { FC } from 'react';
import { isDemoMode } from '@/shared/demo-mode';

export const DemoBanner: FC = () => {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <div
      data-testid="demo-banner"
      role="note"
      style={{
        background: 'var(--colour-info-subtle)',
        borderBottom: '1px solid var(--colour-info)',
        color: 'var(--colour-text-primary)',
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-ui)',
        textAlign: 'center',
      }}
    >
      You&rsquo;re viewing a demo of GPS Action. Data is fake.
    </div>
  );
};
