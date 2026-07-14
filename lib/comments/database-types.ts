export interface Database {
  public: {
    Tables: {
      comments: {
        Row: {
          author_name: string;
          content: string;
          created_at: string;
          id: string;
          post_slug: string;
        };
        Insert: {
          author_name: string;
          content: string;
          created_at?: string;
          id?: string;
          post_slug: string;
        };
        Update: {
          author_name?: string;
          content?: string;
          created_at?: string;
          id?: string;
          post_slug?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
