import { SiteLayoutContainer } from '@/components/site-layout-container';
import { createRootMetadata } from '@/lib/seo-metadata';
import { createSiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = createRootMetadata('ko');

export default function KoreanRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createSiteJsonLd('ko') }} />
        <SiteLayoutContainer locale="ko">{children}</SiteLayoutContainer>
      </body>
    </html>
  );
}
