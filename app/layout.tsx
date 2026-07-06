import { SiteLayoutContainer } from '@/components/site-layout-container';
import { createRootMetadata } from '@/lib/seo-metadata';
import { createSiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: createSiteJsonLd() }} />
        <SiteLayoutContainer>{children}</SiteLayoutContainer>
      </body>
    </html>
  );
}
