import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnvironment } from '../supabase/environment';
import type { BlogComment, CommentRepository, CreateCommentInput } from './comment-types';
import type { Database } from './database-types';

const COMMENT_SELECT_COLUMNS = 'id, post_slug, author_name, content, created_at';
const COMMENT_LIST_LIMIT = 100;

type CommentRow = Database['public']['Tables']['comments']['Row'];

export class SupabaseCommentRepository implements CommentRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  async findByPostSlug(postSlug: string): Promise<BlogComment[]> {
    const { data: commentRows, error } = await this.supabaseClient
      .from('comments')
      .select(COMMENT_SELECT_COLUMNS)
      .eq('post_slug', postSlug)
      .order('created_at', { ascending: true })
      .limit(COMMENT_LIST_LIMIT);

    if (error != null) {
      throw new Error('댓글 목록 조회에 실패했습니다.', { cause: error });
    }

    return commentRows.map(mapCommentRow);
  }

  async create(input: CreateCommentInput): Promise<BlogComment> {
    const { data: commentRow, error } = await this.supabaseClient
      .from('comments')
      .insert({
        post_slug: input.postSlug,
        author_name: input.authorName,
        content: input.content,
      })
      .select(COMMENT_SELECT_COLUMNS)
      .single();

    if (error != null) {
      throw new Error('댓글 저장에 실패했습니다.', { cause: error });
    }

    return mapCommentRow(commentRow);
  }
}

let cachedCommentRepository: CommentRepository | null = null;

export function getSupabaseCommentRepository(): CommentRepository {
  if (cachedCommentRepository != null) {
    return cachedCommentRepository;
  }

  const environment = getSupabaseEnvironment();
  const supabaseClient = createClient<Database>(environment.url, environment.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  cachedCommentRepository = new SupabaseCommentRepository(supabaseClient);

  return cachedCommentRepository;
}

function mapCommentRow(commentRow: CommentRow): BlogComment {
  return {
    id: commentRow.id,
    postSlug: commentRow.post_slug,
    authorName: commentRow.author_name,
    content: commentRow.content,
    createdAt: commentRow.created_at,
  };
}
