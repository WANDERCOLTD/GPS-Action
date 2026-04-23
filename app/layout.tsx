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
