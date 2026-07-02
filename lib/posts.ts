import fs from 'node:fs';
import path from 'node:path';

const postsDirectory = path.join(process.cwd(), 'content', 'posts');

export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export interface Post extends PostSummary {
  content: string;
}

interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
}

export function getPostSummaries(): PostSummary[] {
  return getPostSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is Post => post != null)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
    }))
    .sort((leftPost, rightPost) => rightPost.date.localeCompare(leftPost.date));
}

export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(postsDirectory, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, content } = parsePostFile(fileContent);

  return {
    slug,
    ...frontmatter,
    content,
  };
}

function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(postsDirectory)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''));
}

function parsePostFile(fileContent: string): {
  frontmatter: PostFrontmatter;
  content: string;
} {
  const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = fileContent.match(frontmatterPattern);

  if (!match) {
    throw new Error('Post file must start with frontmatter.');
  }

  return {
    frontmatter: parseFrontmatter(match[1]),
    content: match[2].trim(),
  };
}

function parseFrontmatter(frontmatterContent: string): PostFrontmatter {
  const entries = frontmatterContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(':');

      if (separatorIndex === -1) {
        throw new Error(`Invalid frontmatter line: ${line}`);
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^"|"$/g, '');

      return [key, value] as const;
    });

  const frontmatter = Object.fromEntries(entries);

  return {
    title: readFrontmatterValue(frontmatter, 'title'),
    description: readFrontmatterValue(frontmatter, 'description'),
    date: readFrontmatterValue(frontmatter, 'date'),
  };
}

function readFrontmatterValue(frontmatter: Record<string, unknown>, key: keyof PostFrontmatter): string {
  const value = frontmatter[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing frontmatter value: ${key}`);
  }

  return value;
}
