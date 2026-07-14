import { SiteLayoutContainer } from '@/components/site-layout-container';
import { createRootMetadata } from '@/lib/seo-metadata';
import { createSiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import '../../globals.css';

export const metadata: Metadata = createRootMetadata('en');

export default function EnglishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createSiteJsonLd('en') }} />
        <SiteLayoutContainer locale="en">{children}</SiteLayoutContainer>
      </body>
    </html>
  );
}
