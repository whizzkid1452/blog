import { commentCreateResponseSchema, commentListResponseSchema, createCommentSchema } from '../model/comment-schema';
import type { BlogComment, CreateCommentInput } from '../model/comment-types';

export interface CommentsApiClient {
  list(signal?: AbortSignal): Promise<BlogComment[]>;
  create(input: Omit<CreateCommentInput, 'postSlug'>): Promise<BlogComment>;
}

interface CreateCommentsApiClientParams {
  postSlug: string;
  fetchImplementation?: typeof fetch;
}

const COMMENTS_API_PATH = '/api/posts';

export function createCommentsApiClient({
  postSlug,
  fetchImplementation = fetch,
}: CreateCommentsApiClientParams): CommentsApiClient {
  const apiPath = `${COMMENTS_API_PATH}/${encodeURIComponent(postSlug)}/comments`;

  return {
    async list(signal) {
      const response = await fetchImplementation(apiPath, { cache: 'no-store', signal });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        throw new Error('Comment list request failed.');
      }

      const parsedResponse = commentListResponseSchema.safeParse(responseBody);

      if (!parsedResponse.success) {
        throw new Error('Comment list response is invalid.');
      }

      return parsedResponse.data.comments;
    },
    async create(input) {
      const parsedInput = createCommentSchema.parse(input);
      const response = await fetchImplementation(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedInput),
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        throw new Error('Comment create request failed.');
      }

      const parsedResponse = commentCreateResponseSchema.safeParse(responseBody);

      if (!parsedResponse.success) {
        throw new Error('Comment create response is invalid.');
      }

      return parsedResponse.data.comment;
    },
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
