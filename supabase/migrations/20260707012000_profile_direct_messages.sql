-- Enable direct profile-to-profile messages for accepted friends.

create or replace function public.are_friends(profile_a uuid, profile_b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = profile_a and addressee_id = profile_b)
        or
        (requester_id = profile_b and addressee_id = profile_a)
      )
  );
$$;

drop policy if exists "participants can read chat messages" on public.chat_messages;
create policy "participants can read chat messages"
on public.chat_messages for select
to authenticated
using (
  sender_id = auth.uid()
  or (
    thread_type = 'profile'
    and thread_id = auth.uid()
    and public.are_friends(sender_id, auth.uid())
  )
  or (thread_type = 'group' and public.is_group_participant(thread_id))
  or (thread_type = 'party' and public.is_party_participant(thread_id))
);

drop policy if exists "participants can send chat messages" on public.chat_messages;
create policy "participants can send chat messages"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (
      thread_type = 'profile'
      and thread_id <> auth.uid()
      and public.are_friends(auth.uid(), thread_id)
    )
    or (thread_type = 'group' and public.is_group_participant(thread_id))
    or (thread_type = 'party' and public.is_party_participant(thread_id))
  )
);

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
          chat_messages.thread_type = 'profile'
          and chat_messages.thread_id = auth.uid()
          and public.are_friends(chat_messages.sender_id, auth.uid())
        )
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
