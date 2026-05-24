-- =============================================================
-- Proximity Radar – Datenbankschema
-- In Supabase SQL Editor ausführen
-- PostGIS ist in jedem Supabase-Projekt bereits aktiviert.
-- =============================================================

-- ─── 1. user_locations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  geog         geography(Point, 4326) NOT NULL,
  radius_m     integer NOT NULL DEFAULT 500,
  visibility   text NOT NULL DEFAULT 'public'
               CHECK (visibility IN ('public', 'friends', 'hidden')),
  intent       text NOT NULL DEFAULT 'active'
               CHECK (intent IN ('active', 'date', 'hangout')),
  geohash6     text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_locations_geog_idx
  ON public.user_locations USING GIST (geog);
CREATE INDEX IF NOT EXISTS user_locations_geohash_idx
  ON public.user_locations (geohash6);
CREATE INDEX IF NOT EXISTS user_locations_updated_idx
  ON public.user_locations (updated_at DESC);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Eigene Zeile darf immer geschrieben/gelesen werden
CREATE POLICY "owner_all" ON public.user_locations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Öffentliche Standorte lesbar für eingeloggte User
CREATE POLICY "public_read" ON public.user_locations
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (visibility = 'public' OR user_id = auth.uid())
  );

-- Realtime aktivieren: in Supabase Dashboard →
--   Table Editor → user_locations → Enable Realtime


-- ─── 2. proximity_events (Notification-Dedup) ─────────────────
CREATE TABLE IF NOT EXISTS public.proximity_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id       uuid NOT NULL,
  target_type     text NOT NULL CHECK (target_type IN ('user', 'business', 'party')),
  notified_at     timestamptz NOT NULL DEFAULT now(),
  cooldown_until  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS proximity_events_lookup_idx
  ON public.proximity_events (user_id, target_id, cooldown_until DESC);

ALTER TABLE public.proximity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON public.proximity_events
  FOR ALL USING (auth.uid() = user_id);


-- ─── 3. notification_tokens ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text NOT NULL DEFAULT 'ios',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON public.notification_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── 4. nearby_entities() RPC ────────────────────────────────
-- Gibt alle aktiven User im Umkreis zurück.
-- Erweiterbar für businesses / parties als UNION.

CREATE OR REPLACE FUNCTION public.nearby_entities(
  my_lat    double precision,
  my_lon    double precision,
  radius_m  integer,
  viewer_id uuid
)
RETURNS TABLE (
  entity_id    uuid,
  entity_type  text,
  display_name text,
  avatar_url   text,
  distance_m   double precision,
  intent       text,
  geohash6     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ul.user_id::uuid                                           AS entity_id,
    'user'::text                                               AS entity_type,
    COALESCE(p.display_name, 'Local')                         AS display_name,
    p.avatar_url                                               AS avatar_url,
    ST_Distance(
      ul.geog,
      ST_MakePoint(my_lon, my_lat)::geography
    )::double precision                                        AS distance_m,
    ul.intent                                                  AS intent,
    ul.geohash6                                                AS geohash6
  FROM public.user_locations ul
  LEFT JOIN public.profiles p ON p.id = ul.user_id
  WHERE
    ST_DWithin(
      ul.geog,
      ST_MakePoint(my_lon, my_lat)::geography,
      radius_m
    )
    AND ul.user_id          != viewer_id
    AND ul.visibility        != 'hidden'
    AND ul.updated_at        > (now() - interval '10 minutes')
  ORDER BY distance_m
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_entities TO authenticated;


-- ─── 5. Automatisches Cleanup alter Einträge ──────────────────
-- Optional via pg_cron (Supabase Pro):
-- SELECT cron.schedule('cleanup-stale-locations', '*/15 * * * *',
--   $$DELETE FROM public.user_locations WHERE updated_at < now() - interval '20 minutes'$$);
