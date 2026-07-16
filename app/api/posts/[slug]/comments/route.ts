import {
  createCommentRouteHandlers,
  type CommentRouteContext,
} from '@/features/comments/server/comment-route-handlers';
import { getSupabaseCommentRepository } from '@/features/comments/server/supabase-comment-repository';
import { getPostBySlug } from '@/features/posts/server/post-repository';

export const dynamic = 'force-dynamic';

const routeHandlers = createCommentRouteHandlers({
  doesPostExist: postSlug => getPostBySlug(postSlug) != null,
  getCommentRepository: getSupabaseCommentRepository,
});

export function GET(request: Request, context: CommentRouteContext): Promise<Response> {
  return routeHandlers.GET(request, context);
}

export function POST(request: Request, context: CommentRouteContext): Promise<Response> {
  return routeHandlers.POST(request, context);
}
