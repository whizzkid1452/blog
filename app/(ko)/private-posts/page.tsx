import { HomeView } from '@/components/home-view';
import styles from '@/components/home-view.module.css';
import { requireAuthenticatedGoogleUser } from '@/lib/auth/google-user';
import { getPostIndex } from '@/lib/posts';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '비공개 글',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function PrivatePostsPage() {
  const user = await requireAuthenticatedGoogleUser('/private-posts');
  const posts = getPostIndex().getAuthenticatedPostSummaries();

  return (
    <HomeView
      posts={posts}
      eyebrow="Authenticated"
      title="비공개 글"
      description="Google 계정으로 인증된 사용자만 볼 수 있는 글입니다."
      emptyMessage="비공개 글이 없습니다."
      headerActions={
        <div className={styles.accountActions}>
          <span className={styles.accountEmail}>{user.email ?? 'Google 사용자'}</span>
          <form action="/auth/logout?next=/" method="post">
            <button className={styles.signOutButton} type="submit">
              로그아웃
            </button>
          </form>
        </div>
      }
    />
  );
}
