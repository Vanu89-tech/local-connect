create type public.post_status as enum ('pending', 'visible', 'hidden', 'removed');
create type public.post_category as enum (
  'general',
  'question',
  'event',
  'recommendation',
  'found',
  'warning',
  'party'
);
create type public.report_reason as enum (
  'harassment',
  'hate',
  'sexual',
  'violence',
  'spam',
  'private_info',
  'wrong_location',
  'other'
);

alter table public.posts
add column status public.post_status not null default 'visible',
add column category public.post_category not null default 'general',
add column moderation_note text,
add column hidden_at timestamptz,
add column removed_at timestamptz;

create index posts_visible_created_at_idx
on public.posts (created_at desc)
where status = 'visible';

create index posts_category_created_at_idx
on public.posts (category, created_at desc)
where status = 'visible';

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason public.report_reason not null,
  details text,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.post_reports enable row level security;

create policy "users can report posts"
on public.post_reports for insert
to authenticated
with check (reporter_id = auth.uid());

create policy "users can read their own reports"
on public.post_reports for select
to authenticated
using (reporter_id = auth.uid());
