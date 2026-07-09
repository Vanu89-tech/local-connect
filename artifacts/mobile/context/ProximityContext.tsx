import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { encodeGeohash, geohashNeighbors } from '@/lib/geohash';
import { sendLocalNotification, requestNotificationPermission, getExpoPushToken } from '@/lib/notifications';
import {
  fetchNearbyEntities,
  NearbyEntity,
  RadarIntent,
  RadarVisibility,
  removeMyLocation,
  saveNotificationToken,
  upsertMyLocation,
} from '@/lib/proximity';
import { supabase } from '@/lib/supabase';

// ─── Konstanten ────────────────────────────────────────────────────────────────
const STORAGE_KEY     = 'locals_radar_v1';
const MIN_DIST_M      = 50;      // GPS-Update nur wenn ≥50m bewegt
const MIN_INTERVAL_MS = 30_000;  // maximal alle 30s
const MIN_MAP_LOD_RADIUS_M = 500;

// Cooldown-Zeiten: innerhalb dieser Zeitspanne keine erneute Benachrichtigung
const COOLDOWN: Record<string, number> = {
  date:    30 * 60 * 1000,  // 30 min
  active:  60 * 60 * 1000,  // 1 h
  hangout: 60 * 60 * 1000,  // 1 h
  party:   2  * 60 * 60 * 1000, // 2 h
};

// ─── Typen ─────────────────────────────────────────────────────────────────────
export type RadarSettings = {
  radiusM:    number;           // 200–2000 Meter
  lodRadiusM: number;           // Sichtbarer Symbolradius um den Kartenmittelpunkt
  visibility: RadarVisibility;  // 'public' | 'friends' | 'hidden'
  intent:     RadarIntent;      // 'active' | 'date' | 'hangout'
  enabled:    boolean;
};

const DEFAULT_SETTINGS: RadarSettings = {
  radiusM:    500,
  lodRadiusM: 1000,
  visibility: 'public',
  intent:     'active',
  enabled:    true,
};

function normalizeRadarSettings(settings: Partial<RadarSettings>): Partial<RadarSettings> {
  if (typeof settings.lodRadiusM !== 'number') return settings;
  return {
    ...settings,
    lodRadiusM: Math.max(MIN_MAP_LOD_RADIUS_M, settings.lodRadiusM),
  };
}

type ProximityContextType = {
  nearbyUsers:          NearbyEntity[];
  nearbyParties:        NearbyEntity[];
  radarSettings:        RadarSettings;
  myGeohash6:           string | null;
  myLiveLocation:       { lat: number; lon: number } | null;
  updateRadarSettings:  (patch: Partial<RadarSettings>) => Promise<void>;
  triggerProximityCheck: () => Promise<void>;
};

const ProximityContext = createContext<ProximityContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ProximityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [radarSettings, setRadarSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);
  const [nearbyUsers,   setNearbyUsers]   = useState<NearbyEntity[]>([]);
  const [nearbyParties, setNearbyParties] = useState<NearbyEntity[]>([]);
  const [myGeohash6,    setMyGeohash6]    = useState<string | null>(null);
  const [myLiveLocation, setMyLiveLocation] = useState<{ lat: number; lon: number } | null>(null);

  // Refs: neueste Werte ohne Stale-Closure-Problem in Callbacks
  const settingsRef    = useRef(radarSettings);
  const userRef        = useRef(user);
  const lastPos        = useRef<{ lat: number; lon: number } | null>(null);
  const lastUpdateTime = useRef(0);
  const notifiedUntil  = useRef<Map<string, number>>(new Map()); // entityId → cooldownTimestamp
  const locationSub    = useRef<Location.LocationSubscription | null>(null);
  const realtimeSubs   = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const subscribedGeohash = useRef<string | null>(null);
  const appState       = useRef<AppStateStatus>(AppState.currentState);
  const isMounted      = useRef(true);

  useEffect(() => { settingsRef.current = radarSettings; }, [radarSettings]);
  useEffect(() => { userRef.current = user; },             [user]);
  useEffect(() => () => { isMounted.current = false; },   []);

  // ─── Settings laden ───────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<RadarSettings>;
        setRadarSettings((prev) => ({ ...prev, ...normalizeRadarSettings(saved) }));
      } catch (_) {}
    });
  }, []);

  const updateRadarSettings = useCallback(async (patch: Partial<RadarSettings>) => {
    setRadarSettings((prev) => {
      const next = { ...prev, ...normalizeRadarSettings(patch) };
      settingsRef.current = next;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ─── Proximity-Check ──────────────────────────────────────────────────────
  const runProximityCheck = useCallback(async (lat: number, lon: number) => {
    const uid = userRef.current?.id;
    const settings = settingsRef.current;
    if (!uid || !settings.enabled) return;

    // 1. Eigenen Standort in Supabase aktualisieren
    await upsertMyLocation({
      userId:     uid,
      lat, lon,
      radiusM:    settings.radiusM,
      visibility: settings.visibility,
      intent:     settings.intent,
    });

    // 2. Nahe Entitäten abfragen
    const entities = await fetchNearbyEntities(lat, lon, settings.radiusM, uid);
    if (!isMounted.current) return;

    const users   = entities.filter((e) => e.entity_type === 'user');
    const parties = entities.filter((e) => e.entity_type === 'party');
    setNearbyUsers(users);
    setNearbyParties(parties);

    // 3. Neue Entitäten benachrichtigen (Cooldown-Check)
    const now = Date.now();
    for (const entity of entities) {
      const cooldownUntil = notifiedUntil.current.get(entity.entity_id) ?? 0;
      if (now < cooldownUntil) continue;

      const cooldownMs = COOLDOWN[entity.intent ?? 'active'] ?? COOLDOWN.active;
      notifiedUntil.current.set(entity.entity_id, now + cooldownMs);

      const distText =
        entity.distance_m < 1000
          ? `${Math.round(entity.distance_m)}m entfernt`
          : `${(entity.distance_m / 1000).toFixed(1)}km entfernt`;

      let title: string;
      let body: string;

      if (entity.intent === 'date') {
        title = '💕 Jemand sucht ein Date';
        body  = `${entity.display_name} ist ${distText}`;
      } else if (entity.entity_type === 'party') {
        title = '🎉 Party in der Nähe';
        body  = `${entity.display_name} — ${distText}`;
      } else if (entity.intent === 'hangout') {
        title = '👋 Jemand will abhängen';
        body  = `${entity.display_name} ist ${distText}`;
      } else {
        title = '📍 Jemand ist in der Nähe';
        body  = `${entity.display_name} — ${distText}`;
      }

      await sendLocalNotification({ title, body, data: { entity_id: entity.entity_id } });
    }
  }, []);

  // ─── Realtime-Subscriptions (Phase 5 – geohash-basiert) ──────────────────
  const subscribeRealtime = useCallback((myHash: string) => {
    if (subscribedGeohash.current === myHash && realtimeSubs.current.length > 0) return;
    subscribedGeohash.current = myHash;

    // Alte Subscriptions entfernen
    for (const ch of realtimeSubs.current) {
      supabase.removeChannel(ch);
    }
    realtimeSubs.current = [];

    // Eigene Zelle + 8 Nachbarn abonnieren
    const cells = [myHash, ...geohashNeighbors(myHash)];
    for (const cell of cells) {
      const ch = supabase
        .channel(`proximity:${cell}`)
        .on(
          'postgres_changes',
          {
            event:  '*',
            schema: 'public',
            table:  'user_locations',
            filter: `geohash6=eq.${cell}`,
          },
          () => {
            // Jemand in der Nachbarschaft hat seinen Standort aktualisiert
            if (lastPos.current) {
              void runProximityCheck(lastPos.current.lat, lastPos.current.lon);
            }
          },
        )
        .subscribe();
      realtimeSubs.current.push(ch);
    }
  }, [runProximityCheck]);

  // ─── GPS-Watching ─────────────────────────────────────────────────────────
  const startWatching = useCallback(async () => {
    if (!userRef.current || !settingsRef.current.enabled) return;
    if (locationSub.current) return; // läuft bereits

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy:         Location.Accuracy.Balanced,
        distanceInterval: MIN_DIST_M,
        timeInterval:     MIN_INTERVAL_MS,
      },
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const now = Date.now();

        // Rate-Limit: nicht öfter als MIN_INTERVAL_MS
        if (now - lastUpdateTime.current < MIN_INTERVAL_MS) return;
        lastUpdateTime.current = now;
        lastPos.current = { lat, lon };

        if (!isMounted.current) return;
        setMyLiveLocation({ lat, lon });

        const gh = encodeGeohash(lat, lon, 6);
        setMyGeohash6(gh);

        await runProximityCheck(lat, lon);
        subscribeRealtime(gh);
      },
    );
  }, [runProximityCheck, subscribeRealtime]);

  const stopWatching = useCallback(async () => {
    locationSub.current?.remove();
    locationSub.current = null;

    for (const ch of realtimeSubs.current) {
      await supabase.removeChannel(ch);
    }
    realtimeSubs.current = [];
    subscribedGeohash.current = null;

    const uid = userRef.current?.id;
    if (uid) await removeMyLocation(uid);
  }, []);

  // ─── Push-Token registrieren (Phase 2) ───────────────────────────────────
  const registerPushToken = useCallback(async () => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const granted = await requestNotificationPermission();
    if (!granted) return;
    const token = await getExpoPushToken();
    if (token) await saveNotificationToken(uid, token);
  }, []);

  // ─── App-State: Hintergrund → GPS pausieren ───────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';

      if (wasBackground && next === 'active') {
        await startWatching();
      } else if (next === 'background' || next === 'inactive') {
        await stopWatching();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [startWatching, stopWatching]);

  // ─── Start bei Login / Stop bei Logout ────────────────────────────────────
  useEffect(() => {
    if (user && radarSettings.enabled) {
      void startWatching();
      void registerPushToken();
    } else if (!user) {
      void stopWatching();
    }
    return () => {
      void stopWatching();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, radarSettings.enabled]);

  // ─── Manueller Trigger (z.B. von Settings-Screen) ────────────────────────
  const triggerProximityCheck = useCallback(async () => {
    if (lastPos.current) {
      await runProximityCheck(lastPos.current.lat, lastPos.current.lon);
    }
  }, [runProximityCheck]);

  const value = useMemo<ProximityContextType>(
    () => ({
      nearbyUsers,
      nearbyParties,
      radarSettings,
      myGeohash6,
      myLiveLocation,
      updateRadarSettings,
      triggerProximityCheck,
    }),
    [nearbyUsers, nearbyParties, radarSettings, myGeohash6, myLiveLocation, updateRadarSettings, triggerProximityCheck],
  );

  return (
    <ProximityContext.Provider value={value}>
      {children}
    </ProximityContext.Provider>
  );
}

export function useProximity() {
  const ctx = useContext(ProximityContext);
  if (!ctx) throw new Error('useProximity must be used within ProximityProvider');
  return ctx;
}
