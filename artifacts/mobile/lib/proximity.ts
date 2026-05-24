import { encodeGeohash } from './geohash';
import { supabase } from './supabase';

export type RadarVisibility = 'public' | 'friends' | 'hidden';
export type RadarIntent     = 'active' | 'date' | 'hangout';

export type NearbyEntity = {
  entity_id:    string;
  entity_type:  'user' | 'business' | 'party';
  display_name: string;
  avatar_url:   string | null;
  distance_m:   number;
  intent:       string | null;
  geohash6:     string | null;
};

export async function upsertMyLocation(params: {
  userId:     string;
  lat:        number;
  lon:        number;
  radiusM:    number;
  visibility: RadarVisibility;
  intent:     RadarIntent;
}): Promise<void> {
  const { userId, lat, lon, radiusM, visibility, intent } = params;
  const geohash6 = encodeGeohash(lat, lon, 6);

  const { error } = await supabase.from('user_locations').upsert(
    {
      user_id:    userId,
      geog:       `SRID=4326;POINT(${lon} ${lat})`,
      radius_m:   radiusM,
      visibility,
      intent,
      geohash6,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) console.warn('[proximity] upsert error:', error.message);
}

export async function fetchNearbyEntities(
  myLat:    number,
  myLon:    number,
  radiusM:  number,
  viewerId: string,
): Promise<NearbyEntity[]> {
  const { data, error } = await supabase.rpc('nearby_entities', {
    my_lat:    myLat,
    my_lon:    myLon,
    radius_m:  radiusM,
    viewer_id: viewerId,
  });

  if (error) {
    console.warn('[proximity] rpc error:', error.message);
    return [];
  }
  return (data as NearbyEntity[]) ?? [];
}

export async function removeMyLocation(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_locations')
    .delete()
    .eq('user_id', userId);
  if (error) console.warn('[proximity] delete error:', error.message);
}

export async function saveNotificationToken(userId: string, token: string): Promise<void> {
  await supabase.from('notification_tokens').upsert(
    { user_id: userId, token, platform: 'ios', updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
}
