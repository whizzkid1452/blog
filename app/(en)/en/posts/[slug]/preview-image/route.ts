import { getPostIndexForLocale } from '@/features/posts/server/post-translations';
import { createPostPreviewImageResponse } from '@/features/posts/server/post-preview-image';

interface EnglishPostPreviewImageRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(_request: Request, { params }: EnglishPostPreviewImageRouteContext): Promise<Response> {
  const { slug } = await params;

  return createPostPreviewImageResponse({ postIndex: getPostIndexForLocale('en'), slug });
}
