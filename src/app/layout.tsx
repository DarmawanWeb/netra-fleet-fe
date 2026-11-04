import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n';
import { bootScript } from '@/lib/boot';
import { BrandingProvider } from '@/lib/branding';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'NETRA — Patrol Command Center',
  description: 'Patrol command center for service robots',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <BrandingProvider>{children}</BrandingProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
