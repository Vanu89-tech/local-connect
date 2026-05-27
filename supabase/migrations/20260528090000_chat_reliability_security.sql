-- Chat reliability, media, receipts, and safety basics.
-- Run this after 20260525190000_groups_parties_messages.sql.

alter table public.chat_messages
  add column if not exists client_message_id text,
  add column if not exists message_type text not null default 'text',
  add column if not exists status text not null default 'sent',
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_message_type_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_message_type_check
      check (message_type in ('text', 'image', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_status_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_status_check
      check (status in ('sending', 'sent', 'delivered', 'read', 'failed'));
  end if;
end $$;

create unique index if not exists chat_messages_sender_client_id_idx
on public.chat_messages (sender_id, client_message_id)
where client_message_id is not null;

create index if not exists chat_messages_thread_recent_idx
on public.chat_messages (thread_type, thread_id, created_at desc);

create table if not exists public.message_receipts (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, profile_id)
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'chat-images',
  path text not null,
  mime_type text,
  byte_size integer,
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_idx
on public.message_attachments (message_id);

create table if not exists public.blocked_profiles (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.chat_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default 'other',
  details text,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.message_receipts enable row level security;
alter table public.message_attachments enable row level security;
alter table public.blocked_profiles enable row level security;
alter table public.chat_message_reports enable row level security;

create or replace function public.can_access_chat_message(target_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_messages
    where chat_messages.id = target_message_id
      and (
        chat_messages.sender_id = auth.uid()
        or (
          chat_messages.thread_type = 'group'
          and public.is_group_participant(chat_messages.thread_id)
        )
        or (
          chat_messages.thread_type = 'party'
          and public.is_party_participant(chat_messages.thread_id)
        )
      )
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_receipts'
      and policyname = 'participants can read receipts'
  ) then
    create policy "participants can read receipts"
    on public.message_receipts for select
    to authenticated
    using (public.can_access_chat_message(message_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_receipts'
      and policyname = 'users can write own receipts'
  ) then
    create policy "users can write own receipts"
    on public.message_receipts for insert
    to authenticated
    with check (profile_id = auth.uid() and public.can_access_chat_message(message_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_receipts'
      and policyname = 'users can update own receipts'
  ) then
    create policy "users can update own receipts"
    on public.message_receipts for update
    to authenticated
    using (profile_id = auth.uid() and public.can_access_chat_message(message_id))
    with check (profile_id = auth.uid() and public.can_access_chat_message(message_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_attachments'
      and policyname = 'participants can read attachments'
  ) then
    create policy "participants can read attachments"
    on public.message_attachments for select
    to authenticated
    using (public.can_access_chat_message(message_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_attachments'
      and policyname = 'owners can create attachments'
  ) then
    create policy "owners can create attachments"
    on public.message_attachments for insert
    to authenticated
    with check (owner_id = auth.uid() and public.can_access_chat_message(message_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'blocked_profiles'
      and policyname = 'users manage own blocks'
  ) then
    create policy "users manage own blocks"
    on public.blocked_profiles for all
    to authenticated
    using (blocker_id = auth.uid())
    with check (blocker_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_reports'
      and policyname = 'users create message reports'
  ) then
    create policy "users create message reports"
    on public.chat_message_reports for insert
    to authenticated
    with check (reporter_id = auth.uid() and public.can_access_chat_message(message_id));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'chat images are readable'
  ) then
    create policy "chat images are readable"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'chat-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'users upload own chat images'
  ) then
    create policy "users upload own chat images"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'chat-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
