'use client';

import type { PostSummary } from '@/lib/posts';
import styled from '@emotion/styled';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface SiteLayoutProps {
  children: ReactNode;
  currentYear: number;
  tags: string[];
  recentPosts: PostSummary[];
}

interface NavigationLink {
  href: string;
  label: string;
}

const PRIMARY_NAVIGATION_LINKS: NavigationLink[] = [
  { href: '/', label: 'Home' },
  { href: '/posts', label: 'Posts' },
];

const GITHUB_PROFILE_URL = 'https://github.com/whizzkid1452';
const RECENT_POST_COUNT = 5;
const DESKTOP_HEADER_HEIGHT = '64px';
const DESKTOP_SIDEBAR_WIDTH = '280px';

export function SiteLayout({ children, currentYear, tags, recentPosts }: SiteLayoutProps) {
  const pathname = usePathname();
  const visibleRecentPosts = recentPosts.slice(0, RECENT_POST_COUNT);

  return (
    <SiteShell>
      <SiteHeader>
        <HeaderInner>
          <BrandLink href="/">Blog</BrandLink>
          <PrimaryNavigation aria-label="Primary navigation">
            {PRIMARY_NAVIGATION_LINKS.map(link => (
              <NavigationAnchor
                key={link.href}
                href={link.href}
                aria-current={isNavigationActive({ pathname, href: link.href }) ? 'page' : undefined}
                $isActive={isNavigationActive({ pathname, href: link.href })}
              >
                {link.label}
              </NavigationAnchor>
            ))}
            <ExternalNavigationAnchor
              href={GITHUB_PROFILE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub profile"
            >
              GitHub
            </ExternalNavigationAnchor>
          </PrimaryNavigation>
        </HeaderInner>
      </SiteHeader>

      <BodyLayout>
        <Sidebar aria-label="Blog navigation">
          <SidebarSection>
            <SidebarTitle>Topics</SidebarTitle>
            {tags.length > 0 ? (
              <TagList>
                {tags.map(tag => (
                  <TagLink key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                    #{tag}
                  </TagLink>
                ))}
              </TagList>
            ) : (
              <EmptyText>No topics yet.</EmptyText>
            )}
          </SidebarSection>

          <SidebarSection>
            <SidebarTitle>Recent</SidebarTitle>
            {visibleRecentPosts.length > 0 ? (
              <RecentPostList>
                {visibleRecentPosts.map(post => (
                  <RecentPostItem key={post.slug}>
                    <RecentPostLink href={`/posts/${post.slug}`}>{post.title}</RecentPostLink>
                    <RecentPostDate dateTime={post.date}>{post.date}</RecentPostDate>
                  </RecentPostItem>
                ))}
              </RecentPostList>
            ) : (
              <EmptyText>No posts yet.</EmptyText>
            )}
          </SidebarSection>
        </Sidebar>

        <MainContent>{children}</MainContent>
      </BodyLayout>

      <SiteFooter>
        <FooterInner>
          <FooterText>© {currentYear} Blog</FooterText>
          <FooterLink href="/posts">Archive</FooterLink>
        </FooterInner>
      </SiteFooter>
    </SiteShell>
  );
}

function isNavigationActive({ pathname, href }: { pathname: string; href: string }): boolean {
  if (href === '/') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

const SiteShell = styled.div`
  display: flex;
  min-height: 100vh;
  flex-direction: column;
`;

const SiteHeader = styled.header`
  position: sticky;
  z-index: 10;
  top: 0;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--background) 92%, transparent);
  backdrop-filter: blur(16px);
`;

const HeaderInner = styled.div`
  display: flex;
  width: 100%;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 auto;
  padding: 0 24px;

  @media (max-width: 640px) {
    min-height: 60px;
    gap: 16px;
    padding: 0 20px;
  }
`;

const BrandLink = styled(Link)`
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
  text-decoration: none;
`;

const PrimaryNavigation = styled.nav`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const NavigationAnchor = styled(Link)<{ $isActive: boolean }>`
  border-radius: 6px;
  padding: 8px 10px;
  color: ${({ $isActive }) => ($isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)')};
  font-size: 14px;
  font-weight: ${({ $isActive }) => ($isActive ? 650 : 500)};
  text-decoration: none;

  &:hover {
    background: color-mix(in srgb, var(--color-border) 35%, transparent);
    color: var(--color-text-primary);
  }
`;

const ExternalNavigationAnchor = styled.a`
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    background: color-mix(in srgb, var(--color-border) 35%, transparent);
    color: var(--color-text-primary);
  }
`;

const BodyLayout = styled.div`
  display: grid;
  width: 100%;
  flex: 1;
  grid-template-columns: ${DESKTOP_SIDEBAR_WIDTH} minmax(0, 1fr);
  margin: 0 auto;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  position: fixed;
  z-index: 5;
  top: ${DESKTOP_HEADER_HEIGHT};
  bottom: 0;
  left: 0;
  display: flex;
  width: ${DESKTOP_SIDEBAR_WIDTH};
  flex-direction: column;
  gap: 32px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: transparent transparent;
  scrollbar-width: none;
  border-right: 1px solid var(--color-border);
  padding: 56px 24px 72px;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  &::-webkit-scrollbar-thumb,
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  @media (max-width: 900px) {
    position: static;
    width: auto;
    height: auto;
    order: 2;
    overflow: visible;
    border-top: 1px solid var(--color-border);
    border-right: 0;
    padding: 32px 20px 56px;
  }
`;

const SidebarSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const TagLink = styled(Link)`
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.35;
  text-decoration: none;

  &:hover {
    border-color: var(--color-link);
    color: var(--color-link);
  }
`;

const RecentPostList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const RecentPostItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RecentPostLink = styled(Link)`
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.45;
  text-decoration: none;

  &:hover {
    color: var(--color-link);
  }
`;

const RecentPostDate = styled.time`
  color: var(--color-text-muted);
  font-size: 12px;
`;

const EmptyText = styled.p`
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
`;

const MainContent = styled.main`
  grid-column: 2;
  min-width: 0;
  padding: 56px 24px 72px 56px;

  @media (max-width: 900px) {
    grid-column: auto;
    order: 1;
    padding: 40px 20px 0;
  }
`;

const SiteFooter = styled.footer`
  margin-left: ${DESKTOP_SIDEBAR_WIDTH};
  border-top: 1px solid var(--color-border);

  @media (max-width: 900px) {
    margin-left: 0;
  }
`;

const FooterInner = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 auto;
  padding: 24px;

  @media (max-width: 640px) {
    padding: 24px 20px;
  }
`;

const FooterText = styled.p`
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
`;

const FooterLink = styled(Link)`
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--color-link);
  }
`;
