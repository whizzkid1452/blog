import { SiteLayoutContainer } from '@/components/site-layout-container';
import { createRootMetadata } from '@/lib/seo-metadata';
import { createSiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createSiteJsonLd() }} />
        <SiteLayoutContainer>{children}</SiteLayoutContainer>
      </body>
    </html>
  );
}
