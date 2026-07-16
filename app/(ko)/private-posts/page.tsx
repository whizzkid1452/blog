import { AccountActions } from '@/features/authentication/ui/account-actions/account-actions';
import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { requireAuthenticatedGoogleUser } from '@/features/authentication/server/google-user';
import { getPostIndex } from '@/features/posts/server/post-repository';
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
    <PostListView
      posts={posts}
      eyebrow="Authenticated"
      title="비공개 글"
      description="Google 계정으로 인증된 사용자만 볼 수 있는 글입니다."
      emptyMessage="비공개 글이 없습니다."
      headerActions={
        <AccountActions
          anonymousLabel="Google 사용자"
          email={user.email}
          logoutPath="/auth/logout?next=/"
          signOutLabel="로그아웃"
        />
      }
    />
  );
}
