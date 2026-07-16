import { SiteLayoutContainer } from '@/features/site-shell/ui/site-layout/site-layout-container';
import { createRootMetadata } from '@/features/posts/seo/seo-metadata';
import { createSiteJsonLd } from '@/features/posts/seo/structured-data';
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
