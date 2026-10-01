import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n';
import { ThemeProvider, themeScript } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'NETRA — Patrol Command Center',
  description: 'Patrol command center for Pashupati robots',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
