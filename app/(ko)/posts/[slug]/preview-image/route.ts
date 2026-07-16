import { getPostIndex } from '@/features/posts/server/post-repository';
import { createPostPreviewImageResponse } from '@/features/posts/server/post-preview-image';

interface PostPreviewImageRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(_request: Request, { params }: PostPreviewImageRouteContext): Promise<Response> {
  const { slug } = await params;

  return createPostPreviewImageResponse({ postIndex: getPostIndex(), slug });
}
