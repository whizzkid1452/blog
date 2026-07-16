import { createCommentSchema, postSlugSchema } from '../model/comment-schema';
import type { CommentRepository } from '../model/comment-types';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export interface CommentRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

interface CommentRouteDependencies {
  doesPostExist(postSlug: string): boolean;
  getCommentRepository(): CommentRepository;
}

export interface CommentRouteHandlers {
  GET(request: Request, context: CommentRouteContext): Promise<Response>;
  POST(request: Request, context: CommentRouteContext): Promise<Response>;
}

export function createCommentRouteHandlers(dependencies: CommentRouteDependencies): CommentRouteHandlers {
  return {
    GET: async (_request, context) => {
      const postSlug = await parsePostSlug(context);

      if (postSlug == null || !dependencies.doesPostExist(postSlug)) {
        return createNotFoundResponse();
      }

      try {
        const comments = await dependencies.getCommentRepository().findByPostSlug(postSlug);

        return Response.json({ comments }, { headers: NO_STORE_HEADERS });
      } catch (error) {
        console.error('댓글 목록 조회 실패', error);

        return Response.json({ message: '댓글을 불러오지 못했습니다.' }, { status: 503, headers: NO_STORE_HEADERS });
      }
    },
    POST: async (request, context) => {
      const postSlug = await parsePostSlug(context);

      if (postSlug == null || !dependencies.doesPostExist(postSlug)) {
        return createNotFoundResponse();
      }

      if (isCrossOriginRequest(request)) {
        return Response.json({ message: '허용되지 않은 요청입니다.' }, { status: 403, headers: NO_STORE_HEADERS });
      }

      const requestBody = await readJsonBody(request);
      const parsedComment = createCommentSchema.safeParse(requestBody);

      if (!parsedComment.success) {
        return Response.json({ message: '닉네임과 댓글 내용을 확인해 주세요.' }, { status: 400 });
      }

      try {
        const comment = await dependencies.getCommentRepository().create({
          postSlug,
          ...parsedComment.data,
        });

        return Response.json({ comment }, { status: 201, headers: NO_STORE_HEADERS });
      } catch (error) {
        console.error('댓글 저장 실패', error);

        return Response.json({ message: '댓글을 저장하지 못했습니다.' }, { status: 503, headers: NO_STORE_HEADERS });
      }
    },
  };
}

async function parsePostSlug(context: CommentRouteContext): Promise<string | null> {
  const { slug } = await context.params;
  const parsedSlug = postSlugSchema.safeParse(slug);

  return parsedSlug.success ? parsedSlug.data : null;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isCrossOriginRequest(request: Request): boolean {
  const requestOrigin = request.headers.get('origin');

  return requestOrigin != null && requestOrigin !== new URL(request.url).origin;
}

function createNotFoundResponse(): Response {
  return Response.json({ message: '글을 찾을 수 없습니다.' }, { status: 404, headers: NO_STORE_HEADERS });
}
