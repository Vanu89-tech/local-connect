create extension if not exists pgcrypto;

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.map_presence_mode as enum ('online', 'friend', 'relationship');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null,
  avatar_url text,
  bio text,
  home_location_name text,
  home_lat double precision,
  home_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'New local'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create unique index friendships_unique_pair_idx
on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  location_name text not null,
  location_lat double precision,
  location_lng double precision,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parties_set_updated_at
before update on public.parties
for each row execute function public.set_updated_at();

create table public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (party_id, profile_id)
);

create table public.map_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision,
  lng double precision,
  mode public.map_presence_mode not null default 'online',
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger map_presence_set_updated_at
before update on public.map_presence
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.map_presence enable row level security;

create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "users can insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users can read their friendships"
on public.friendships for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "users can request friendships"
on public.friendships for insert
to authenticated
with check (requester_id = auth.uid());

create policy "users can update their friendships"
on public.friendships for update
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "posts are readable by signed in users"
on public.posts for select
to authenticated
using (true);

create policy "users can create posts"
on public.posts for insert
to authenticated
with check (author_id = auth.uid());

create policy "users can update their posts"
on public.posts for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "users can delete their posts"
on public.posts for delete
to authenticated
using (author_id = auth.uid());

create policy "likes are readable by signed in users"
on public.post_likes for select
to authenticated
using (true);

create policy "users can like as themselves"
on public.post_likes for insert
to authenticated
with check (profile_id = auth.uid());

create policy "users can remove their likes"
on public.post_likes for delete
to authenticated
using (profile_id = auth.uid());

create policy "comments are readable by signed in users"
on public.comments for select
to authenticated
using (true);

create policy "users can create comments"
on public.comments for insert
to authenticated
with check (author_id = auth.uid());

create policy "users can update their comments"
on public.comments for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "users can delete their comments"
on public.comments for delete
to authenticated
using (author_id = auth.uid());

create policy "parties are readable by signed in users"
on public.parties for select
to authenticated
using (true);

create policy "users can create their parties"
on public.parties for insert
to authenticated
with check (host_id = auth.uid());

create policy "hosts can update their parties"
on public.parties for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

create policy "hosts can delete their parties"
on public.parties for delete
to authenticated
using (host_id = auth.uid());

create policy "party members are readable by signed in users"
on public.party_members for select
to authenticated
using (true);

create policy "hosts can add party members"
on public.party_members for insert
to authenticated
with check (
  exists (
    select 1 from public.parties
    where parties.id = party_members.party_id
      and parties.host_id = auth.uid()
  )
);

create policy "hosts can update party members"
on public.party_members for update
to authenticated
using (
  exists (
    select 1 from public.parties
    where parties.id = party_members.party_id
      and parties.host_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.parties
    where parties.id = party_members.party_id
      and parties.host_id = auth.uid()
  )
);

create policy "hosts can remove party members"
on public.party_members for delete
to authenticated
using (
  exists (
    select 1 from public.parties
    where parties.id = party_members.party_id
      and parties.host_id = auth.uid()
  )
);

create policy "presence is readable by signed in users"
on public.map_presence for select
to authenticated
using (true);

create policy "users can insert own presence"
on public.map_presence for insert
to authenticated
with check (profile_id = auth.uid());

create policy "users can update own presence"
on public.map_presence for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "users can delete own presence"
on public.map_presence for delete
to authenticated
using (profile_id = auth.uid());

create or replace function public.increment_post_comments_count()
returns trigger
language plpgsql
as $$
begin
  update public.posts
  set comments_count = comments_count + 1
  where id = new.post_id;
  return new;
end;
$$;

create or replace function public.decrement_post_comments_count()
returns trigger
language plpgsql
as $$
begin
  update public.posts
  set comments_count = greatest(comments_count - 1, 0)
  where id = old.post_id;
  return old;
end;
$$;

create trigger comments_increment_posts_count
after insert on public.comments
for each row execute function public.increment_post_comments_count();

create trigger comments_decrement_posts_count
after delete on public.comments
for each row execute function public.decrement_post_comments_count();

create or replace function public.increment_post_likes_count()
returns trigger
language plpgsql
as $$
begin
  update public.posts
  set likes_count = likes_count + 1
  where id = new.post_id;
  return new;
end;
$$;

create or replace function public.decrement_post_likes_count()
returns trigger
language plpgsql
as $$
begin
  update public.posts
  set likes_count = greatest(likes_count - 1, 0)
  where id = old.post_id;
  return old;
end;
$$;

create trigger likes_increment_posts_count
after insert on public.post_likes
for each row execute function public.increment_post_likes_count();

create trigger likes_decrement_posts_count
after delete on public.post_likes
for each row execute function public.decrement_post_likes_count();
