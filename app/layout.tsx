import { SiteLayout } from '@/components/site-layout';
import { getPostSummaries, getTags } from '@/lib/posts';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { EmotionRegistry } from './emotion-registry';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Blog',
  description: 'A personal blog built with Next.js.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const posts = getPostSummaries();
  const tags = getTags();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <EmotionRegistry>
          <SiteLayout currentYear={new Date().getFullYear()} tags={tags} recentPosts={posts}>
            {children}
          </SiteLayout>
        </EmotionRegistry>
      </body>
    </html>
  );
}
