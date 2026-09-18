import type { Post } from '@/features/posts/model/post';
import { PostIndex } from '@/features/posts/model/post-index';
import { getPostIndex } from '@/features/posts/server/post-repository';
import { cookies } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PostPage, { dynamicParams, generateMetadata, generateStaticParams } from './page';

vi.mock('@/features/posts/server/post-repository', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/posts/server/post-repository')>()),
  getPostIndex: vi.fn(),
}));

vi.mock('@/features/posts/ui/post-view/post-view', () => ({ PostView: () => null }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => {
    throw new Error('글 조회에서 인증 쿠키를 읽을 수 없습니다.');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'public-post',
    title: '공개 글',
    description: '공개 글 설명',
    date: '2026-09-18',
    tags: ['nextjs'],
    content: '공개 본문',
    draft: false,
    visibility: 'public',
    ...overrides,
  };
}

describe('공개 글 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPostIndex).mockReturnValue(
      new PostIndex([
        createPost(),
        createPost({ slug: 'private-post', visibility: 'private' }),
        createPost({ slug: 'draft-post', draft: true }),
      ])
    );
  });

  it('공개된 발행 글만 정적 경로로 생성한다', () => {
    expect(generateStaticParams()).toEqual([{ slug: 'public-post' }]);
    expect(dynamicParams).toBe(false);
  });

  it('인증 쿠키 조회 없이 공개 글을 반환한다', async () => {
    await expect(PostPage({ params: Promise.resolve({ slug: 'public-post' }) })).resolves.toBeDefined();
    expect(cookies).not.toHaveBeenCalled();
  });

  it.each(['private-post', 'draft-post', 'missing-post'])('%s의 본문을 404로 차단한다', async slug => {
    await expect(PostPage({ params: Promise.resolve({ slug }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it.each(['private-post', 'draft-post', 'missing-post'])('%s의 메타데이터를 노출하지 않는다', async slug => {
    await expect(generateMetadata({ params: Promise.resolve({ slug }) })).resolves.toEqual({});
  });

  it('공개 글의 메타데이터를 생성한다', async () => {
    await expect(generateMetadata({ params: Promise.resolve({ slug: 'public-post' }) })).resolves.toMatchObject({
      title: '공개 글',
      description: '공개 글 설명',
    });
  });
});
