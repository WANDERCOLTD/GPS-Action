/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D044, D058)
 * @spec product/scenarios.md (SCN-23)
 *
 * Alert composer — streamlined form for urgent Requests. Category
 * picker (chip selector from active AlertCategory rows) + title + body.
 * On submit creates Request with urgency=true and redirects to /requests.
 */

import { redirect } from 'next/navigation';
import { createTRPCContext } from '@/server/routers/context';
import { listActiveAlertCategories } from '@/server/services/alert-category';
import { AppNav } from '@/components/AppNav';
import { AlertComposer } from '@/components/AlertComposer';
import { createUrgentAction } from '@/app/alert/new/actions';

export const metadata = {
  title: 'Raise an alert — GPS Action',
};

export default async function AlertNewPage() {
  const ctx = await createTRPCContext();
  if (!ctx.user) {
    redirect('/dev/login?returnTo=/alert/new');
  }

  const categories = await listActiveAlertCategories();

  return (
    <>
      <AppNav active={null} />
      <main
        style={{
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <h1 className="gps-title" data-testid="alert-page-title">
          Raise an alert
        </h1>
        <p
          style={{
            color: 'var(--colour-text-secondary)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-6)',
          }}
        >
          Something urgent that needs the team's attention right now. Reviewers see alerts within 10
          seconds — don't use this for routine posts.
        </p>

        {categories.length === 0 ? (
          <p
            style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-sm)' }}
            data-testid="alert-no-categories"
          >
            No alert categories configured. An admin needs to seed at least one.
          </p>
        ) : (
          <AlertComposer categories={categories} onSubmit={createUrgentAction} />
        )}
      </main>
    </>
  );
}
