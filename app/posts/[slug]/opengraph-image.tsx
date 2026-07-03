import { getPostBySlug, getPostSummaries } from '@/lib/posts';
import { SITE_AUTHOR_NAME, SITE_NAME } from '@/lib/site-config';
import { ImageResponse } from 'next/og';

interface PostOpenGraphImageProps {
  params: Promise<{
    slug: string;
  }>;
}

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const MAX_VISIBLE_TAG_COUNT = 4;

export const alt = 'Blog post preview image';
export const size = {
  width: IMAGE_WIDTH,
  height: IMAGE_HEIGHT,
};
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return getPostSummaries().map(post => ({
    slug: post.slug,
  }));
}

export default async function PostOpenGraphImage({ params }: PostOpenGraphImageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (post == null) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#f8fafc',
        color: '#111827',
        padding: '72px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            color: '#2563eb',
            fontSize: 30,
            fontWeight: 700,
            marginBottom: 30,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: 'flex',
            maxHeight: 310,
            overflow: 'hidden',
            color: '#111827',
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.16,
            wordBreak: 'keep-all',
          }}
        >
          {post.title}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {post.tags.slice(0, MAX_VISIBLE_TAG_COUNT).map(tag => (
            <div
              key={tag}
              style={{
                display: 'flex',
                border: '2px solid #d4d4d8',
                borderRadius: 999,
                color: '#3f3f46',
                fontSize: 24,
                fontWeight: 600,
                marginRight: 12,
                padding: '8px 18px',
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', color: '#52525b', fontSize: 24, fontWeight: 600 }}>{SITE_AUTHOR_NAME}</div>
      </div>
    </div>,
    {
      ...size,
    }
  );
}
