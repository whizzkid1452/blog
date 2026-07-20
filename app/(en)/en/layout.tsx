import { SiteLayoutContainer } from '@/features/site-shell/ui/site-layout/site-layout-container';
import { createRootMetadata } from '@/features/posts/seo/seo-metadata';
import { createSiteJsonLd } from '@/features/posts/seo/structured-data';
import { THEME_INITIALIZATION_SCRIPT } from '@/features/site-shell/model/theme-initialization-script';
import type { Metadata } from 'next';
import '../../globals.css';

export const metadata: Metadata = createRootMetadata('en');

export default function EnglishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createSiteJsonLd('en') }} />
        <SiteLayoutContainer locale="en">{children}</SiteLayoutContainer>
      </body>
    </html>
  );
}
