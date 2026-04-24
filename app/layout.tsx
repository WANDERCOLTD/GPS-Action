/**
 * @build-unit BU-000-scaffold BU-001-lite
 * @spec architecture/decision-log.md (D003)
 *
 * Next.js root layout — PWA shell. Renders on every page.
 * BU-001-lite adds the LoggedInAs header for dev user switching.
 */
import type { ReactNode } from 'react';
import '@/styles/tokens.css';
import '@/styles/components.css';
import { LoggedInAs } from '@/components/auth/LoggedInAs';
import { createTRPCContext } from '@/server/routers/context';

export const metadata = {
  title: 'GPS Action',
  description: 'Coordinated activism platform',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ctx = await createTRPCContext();

  return (
    <html lang="en" data-theme="light">
      <body>
        <LoggedInAs user={ctx.user} />
        {children}
      </body>
    </html>
  );
}
