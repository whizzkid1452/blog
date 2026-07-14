create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint comments_post_slug_format_check check (
    char_length(post_slug) between 1 and 160
    and post_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint comments_author_name_length_check check (
    char_length(author_name) between 1 and 40
    and author_name = btrim(author_name)
  ),
  constraint comments_content_length_check check (
    char_length(content) between 1 and 1000
    and content = btrim(content)
  )
);

create index comments_post_slug_created_at_idx on public.comments (post_slug, created_at, id);

alter table public.comments enable row level security;

revoke all on table public.comments from anon, authenticated;
grant select, insert on table public.comments to anon;

create policy "Public comments are readable"
on public.comments
for select
to anon
using (true);

create policy "Public comments are writable"
on public.comments
for insert
to anon
with check (true);
