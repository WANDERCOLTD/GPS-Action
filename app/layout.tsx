/**
 * @build-unit BU-000-scaffold
 * @spec architecture/decision-log.md (D003)
 *
 * Next.js root layout — PWA shell. Renders on every page.
 */
import type { ReactNode } from 'react';
import '@/styles/tokens.css';
import '@/styles/components.css';

export const metadata = {
  title: 'GPS Action',
  description: 'Coordinated activism platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
