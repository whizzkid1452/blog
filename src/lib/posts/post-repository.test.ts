import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAllPosts, getPublishedPosts } from './post-repository';

let postsDirectory: string | null = null;

afterEach(async () => {
  if (postsDirectory == null) {
    return;
  }

  await rm(postsDirectory, { recursive: true, force: true });
  postsDirectory = null;
});

async function createPostsDirectory() {
  postsDirectory = await mkdtemp(join(tmpdir(), 'seo-blog-posts-'));
  return postsDirectory;
}

async function writePostFile({
  directory,
  fileName,
  frontmatter,
  body = '본문입니다.',
}: {
  directory: string;
  fileName: string;
  frontmatter: string;
  body?: string;
}) {
  await writeFile(join(directory, fileName), `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
}

describe('post repository', () => {
  it('normalizes post frontmatter and slug from an MDX file', async () => {
    const directory = await createPostsDirectory();

    await writePostFile({
      directory,
      fileName: 'nextjs-seo.mdx',
      frontmatter: [
        'title: "Next.js SEO"',
        'description: "Next.js App Router SEO basics"',
        'publishedAt: "2026-07-01"',
        'updatedAt: "2026-07-02"',
        'tags: ["nextjs", "seo"]',
        'draft: false',
      ].join('\n'),
    });

    const posts = await getAllPosts({ postsDirectory: directory });

    expect(posts).toEqual([
      {
        slug: 'nextjs-seo',
        title: 'Next.js SEO',
        description: 'Next.js App Router SEO basics',
        publishedAt: '2026-07-01',
        updatedAt: '2026-07-02',
        tags: ['nextjs', 'seo'],
        draft: false,
        body: '본문입니다.\n',
      },
    ]);
  });

  it('excludes draft posts from the published post list', async () => {
    const directory = await createPostsDirectory();

    await writePostFile({
      directory,
      fileName: 'published-post.mdx',
      frontmatter: [
        'title: "Published Post"',
        'description: "Visible post"',
        'publishedAt: "2026-07-01"',
        'tags: ["seo"]',
        'draft: false',
      ].join('\n'),
    });
    await writePostFile({
      directory,
      fileName: 'draft-post.mdx',
      frontmatter: [
        'title: "Draft Post"',
        'description: "Hidden post"',
        'publishedAt: "2026-07-01"',
        'tags: ["seo"]',
        'draft: true',
      ].join('\n'),
    });

    const posts = await getPublishedPosts({ postsDirectory: directory });

    expect(posts.map(post => post.slug)).toEqual(['published-post']);
  });

  it('throws a clear error when required frontmatter is missing', async () => {
    const directory = await createPostsDirectory();

    await writePostFile({
      directory,
      fileName: 'invalid-post.mdx',
      frontmatter: ['title: "Invalid Post"', 'publishedAt: "2026-07-01"', 'tags: ["seo"]'].join('\n'),
    });

    await expect(getAllPosts({ postsDirectory: directory })).rejects.toThrow('Invalid frontmatter in invalid-post.mdx');
  });
});
