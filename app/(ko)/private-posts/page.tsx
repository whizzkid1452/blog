import { AccountActions } from '@/features/authentication/ui/account-actions/account-actions';
import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { requireAuthorizedGoogleUser } from '@/features/authentication/server/google-user';
import { getPostIndex } from '@/features/posts/server/post-repository';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '비공개·초안 글',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function PrivatePostsPage() {
  const user = await requireAuthorizedGoogleUser('/private-posts');
  const posts = getPostIndex().getAuthorizedPostSummaries();

  return (
    <PostListView
      posts={posts}
      eyebrow="Private"
      title="비공개·초안 글"
      description="허용된 Google 계정만 볼 수 있는 비공개 글과 초안입니다."
      emptyMessage="비공개 글이나 초안이 없습니다."
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
