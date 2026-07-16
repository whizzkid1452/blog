import { AccountActions } from '@/features/authentication/ui/account-actions/account-actions';
import { PostListView } from '@/features/posts/ui/post-list/post-list-view';
import { requireAuthenticatedGoogleUser } from '@/features/authentication/server/google-user';
import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
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
    <PostListView
      locale="en"
      posts={posts}
      eyebrow="Authenticated"
      title="Private posts"
      description="These posts are available only to users authenticated with Google."
      emptyMessage="No private posts yet."
      headerActions={
        <AccountActions
          anonymousLabel="Google user"
          email={user.email}
          logoutPath="/auth/logout?next=/en"
          signOutLabel="Sign out"
        />
      }
    />
  );
}
