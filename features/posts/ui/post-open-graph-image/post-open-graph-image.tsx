import type { Post } from '../../model/post';
import { SITE_AUTHOR_NAME, SITE_NAME } from '@/shared/config/site-config';
import { ImageResponse } from 'next/og';

export const POST_OPEN_GRAPH_IMAGE_ALT = 'Blog post preview image';
export const POST_OPEN_GRAPH_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};
export const POST_OPEN_GRAPH_IMAGE_CONTENT_TYPE = 'image/png';

const MAX_VISIBLE_TAG_COUNT = 4;

export function createPostOpenGraphImage(post: Post): ImageResponse {
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
    POST_OPEN_GRAPH_IMAGE_SIZE
  );
}
