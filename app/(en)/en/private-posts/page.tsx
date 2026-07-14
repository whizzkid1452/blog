import { HomeView } from '@/components/home-view';
import styles from '@/components/home-view.module.css';
import { requireAuthenticatedGoogleUser } from '@/lib/auth/google-user';
import { getPostIndexForLocale } from '@/lib/post-translations';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Private posts',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function EnglishPrivatePostsPage() {
  const user = await requireAuthenticatedGoogleUser('/en/private-posts');
  const posts = getPostIndexForLocale('en').getAuthenticatedPostSummaries();

  return (
    <HomeView
      locale="en"
      posts={posts}
      eyebrow="Authenticated"
      title="Private posts"
      description="These posts are available only to users authenticated with Google."
      emptyMessage="No private posts yet."
      headerActions={
        <div className={styles.accountActions}>
          <span className={styles.accountEmail}>{user.email ?? 'Google user'}</span>
          <form action="/auth/logout?next=/en" method="post">
            <button className={styles.signOutButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      }
    />
  );
}
