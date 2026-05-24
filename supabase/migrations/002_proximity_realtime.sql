-- =============================================================
-- Realtime für user_locations aktivieren
-- In Supabase Dashboard: Table Editor → user_locations → ⚡ Realtime
-- ODER via SQL:
-- =============================================================

-- Realtime-Publikation: user_locations hinzufügen
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;

-- Hinweis: Damit die geohash6-basierte Filterung in Realtime funktioniert,
-- muss die Tabelle in der Supabase Realtime-Publikation mit
-- "Full table changes" aktiviert sein (nicht nur INSERT, sondern auch UPDATE).
