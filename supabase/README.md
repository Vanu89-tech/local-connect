# Supabase Setup

Locals uses Supabase Auth. User profiles are keyed by `auth.users.id`; no Clerk
mapping is needed.

## First Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
3. Apply the migration in `supabase/migrations`.

With the Supabase CLI installed:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Without the CLI, paste the migration SQL into the Supabase SQL editor.

## Tables

- `profiles`: public profile data for Supabase Auth users
- `friendships`: friend requests and accepted friendships
- `posts`: local feed posts
- `post_likes`: likes per profile/post
- `comments`: post comments
- `parties`: active and historical parties
- `party_members`: invited/joined party members
- `map_presence`: live map location/status for Realtime

## Auth Model

The `profiles.id` value is the Supabase Auth user id. A trigger creates a profile
automatically after signup using metadata from the auth user.

RLS is enabled for all tables. Signed-in users can read social data, while writes
are limited to rows owned by the current `auth.uid()` or parties hosted by it.

## API Auth

The Expo app signs users in with Supabase Auth and stores the session on-device.
The Express API expects protected requests to include:

```http
Authorization: Bearer <supabase-access-token>
```

For now, read endpoints such as `/api/posts` stay public while `/api/me` and
write endpoints require a valid Supabase session.
