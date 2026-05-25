create type public.chat_thread_type as enum ('profile', 'group', 'party');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity text,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_type public.chat_thread_type not null,
  thread_id uuid not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create index groups_owner_created_at_idx
on public.groups (owner_id, created_at desc);

create index group_members_profile_idx
on public.group_members (profile_id);

create index chat_messages_thread_created_at_idx
on public.chat_messages (thread_type, thread_id, created_at);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.is_group_participant(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where groups.id = target_group_id
      and groups.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.group_members
    where group_members.group_id = target_group_id
      and group_members.profile_id = auth.uid()
  );
$$;

create or replace function public.is_party_participant(target_party_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parties
    where parties.id = target_party_id
      and parties.host_id = auth.uid()
  )
  or exists (
    select 1 from public.party_members
    where party_members.party_id = target_party_id
      and party_members.profile_id = auth.uid()
  );
$$;

create policy "group participants can read groups"
on public.groups for select
to authenticated
using (public.is_group_participant(id));

create policy "users can create groups"
on public.groups for insert
to authenticated
with check (owner_id = auth.uid());

create policy "owners can update groups"
on public.groups for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners can delete groups"
on public.groups for delete
to authenticated
using (owner_id = auth.uid());

create policy "group participants can read group members"
on public.group_members for select
to authenticated
using (public.is_group_participant(group_id));

create policy "owners can add group members"
on public.group_members for insert
to authenticated
with check (
  exists (
    select 1 from public.groups
    where groups.id = group_members.group_id
      and groups.owner_id = auth.uid()
  )
);

create policy "owners can update group members"
on public.group_members for update
to authenticated
using (
  exists (
    select 1 from public.groups
    where groups.id = group_members.group_id
      and groups.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.groups
    where groups.id = group_members.group_id
      and groups.owner_id = auth.uid()
  )
);

create policy "owners can remove group members"
on public.group_members for delete
to authenticated
using (
  exists (
    select 1 from public.groups
    where groups.id = group_members.group_id
      and groups.owner_id = auth.uid()
  )
);

create policy "participants can read chat messages"
on public.chat_messages for select
to authenticated
using (
  sender_id = auth.uid()
  or (thread_type = 'group' and public.is_group_participant(thread_id))
  or (thread_type = 'party' and public.is_party_participant(thread_id))
);

create policy "participants can send chat messages"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (thread_type = 'group' and public.is_group_participant(thread_id))
    or (thread_type = 'party' and public.is_party_participant(thread_id))
  )
);
