import {
  POST_OPEN_GRAPH_IMAGE_ALT,
  POST_OPEN_GRAPH_IMAGE_CONTENT_TYPE,
  POST_OPEN_GRAPH_IMAGE_SIZE,
  createPostOpenGraphImage,
} from '@/components/post-open-graph-image';
import { getPostIndexForLocale } from '@/lib/post-translations';

interface EnglishPostOpenGraphImageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const alt = POST_OPEN_GRAPH_IMAGE_ALT;
export const size = POST_OPEN_GRAPH_IMAGE_SIZE;
export const contentType = POST_OPEN_GRAPH_IMAGE_CONTENT_TYPE;
export const dynamicParams = false;

export function generateStaticParams() {
  return getPostIndexForLocale('en')
    .getPostSummaries()
    .map(post => ({ slug: post.slug }));
}

export default async function EnglishPostOpenGraphImage({ params }: EnglishPostOpenGraphImageProps) {
  const { slug } = await params;
  const post = getPostIndexForLocale('en').getPostBySlug(slug);

  return post == null ? new Response('Not found', { status: 404 }) : createPostOpenGraphImage(post);
}
