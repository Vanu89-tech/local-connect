import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { supabase } from "@/lib/supabase";

export type HomeLocation = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
};

export type LocationMode = "live" | "home" | "pending";
export type AppPresenceMode = "online" | "home";

type LocationContextType = {
  locationMode: LocationMode;
  appPresenceMode: AppPresenceMode;
  effectivePresenceMode: AppPresenceMode;
  currentLocationName: string | null;
  homeLocation: HomeLocation | null;
  gpsGranted: boolean;
  hasCompletedSetup: boolean;
  hasSelectedStartMode: boolean;
  setHomeLocation: (loc: HomeLocation) => Promise<void>;
  chooseStartMode: (mode: AppPresenceMode) => Promise<AppPresenceMode>;
  requestGpsPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
};

const HOME_RADIUS_METERS = 500;
const STORAGE_KEY = "locals_location";

const LocationContext = createContext<LocationContextType | null>(null);

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [homeLocation, setHomeLocationState] = useState<HomeLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("pending");
  const [appPresenceMode, setAppPresenceMode] = useState<AppPresenceMode>("home");
  const [hasSelectedStartMode, setHasSelectedStartMode] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  useEffect(() => {
    loadSaved();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInBackground =
        appState.current === "background" || appState.current === "inactive";
      if (wasInBackground && nextState === "active") {
        setHasSelectedStartMode(false);
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const detectCurrentLocation = useCallback(
    async (home: HomeLocation | null) => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = pos.coords;

        // If user is near home → show home name (protect address)
        if (home) {
          const dist = distanceMeters(latitude, longitude, home.lat, home.lng);
          if (dist <= HOME_RADIUS_METERS) {
            setCurrentLocationName(home.name || "Daheim");
            setLocationMode("home");
            return "home" as LocationMode;
          }
        }

        // Away from home → reverse geocode to city/district level
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const name = [place.district || place.subregion, place.city]
          .filter(Boolean)
          .join(", ");
        setCurrentLocationName(name || place.city || "Nearby");
        setLocationMode("live");
        return "live" as LocationMode;
      } catch (_) {
        if (home) {
          setCurrentLocationName(home.name || "Daheim");
          setLocationMode("home");
          return "home" as LocationMode;
        }
      }
      return "pending" as LocationMode;
    },
    []
  );

  const loadSaved = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let homeLoc: HomeLocation | null = null;

      if (raw) {
        const data = JSON.parse(raw);
        if (data.homeLocation?.address && data.homeLocation?.lat && data.homeLocation?.lng) {
          homeLoc = data.homeLocation;
        }
      }

      // Fallback: load from Supabase profile if AsyncStorage has no location
      if (!homeLoc) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("home_lat, home_lng, home_location_name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.home_lat && profile.home_lng) {
            homeLoc = {
              name: "Daheim",
              // Use home_location_name as address fallback so routing check passes
              address: profile.home_location_name ?? "Daheim",
              lat: profile.home_lat,
              lng: profile.home_lng,
            };
            // Restore into AsyncStorage so routing logic works on next cold start
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ homeLocation: homeLoc }));
            await AsyncStorage.setItem("locals_onboarding_seen", "1");
          }
        }
      }

      if (homeLoc) {
        setHomeLocationState(homeLoc);
        setHasCompletedSetup(true);
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          setGpsGranted(true);
          await detectCurrentLocation(homeLoc);
        } else {
          setCurrentLocationName(homeLoc.name || "Daheim");
          setLocationMode("home");
        }
      }
    } catch (_) {}
  };

  const requestGpsPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    setGpsGranted(granted);
    return granted;
  }, []);

  const setHomeLocation = useCallback(async (loc: HomeLocation) => {
    setHomeLocationState(loc);
    setHasCompletedSetup(true);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ homeLocation: loc }));
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      setCurrentLocationName(loc.name || "Daheim");
      setLocationMode("home");
    }
    // Persist lat/lng to Supabase so the home zone survives reinstalls and device changes
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          home_lat: loc.lat,
          home_lng: loc.lng,
          // home_address saved when migration 20260601120000 is applied
          ...(loc.address ? { home_address: loc.address } : {}),
        }).eq("id", user.id);
      }
    } catch (_) {}
  }, []);

  const refreshLocation = useCallback(async () => {
    if (gpsGranted) {
      await detectCurrentLocation(homeLocation);
    }
  }, [gpsGranted, homeLocation, detectCurrentLocation]);

  const chooseStartMode = useCallback(
    async (mode: AppPresenceMode) => {
      let nextLocationMode = locationMode;
      if (gpsGranted) {
        nextLocationMode = await detectCurrentLocation(homeLocation);
      }

      setHasSelectedStartMode(true);
      const nextMode = nextLocationMode === "home" ? "home" : mode;
      setAppPresenceMode(nextMode);
      return nextMode;
    },
    [detectCurrentLocation, gpsGranted, homeLocation, locationMode],
  );

  const effectivePresenceMode: AppPresenceMode =
    locationMode === "home" ? "home" : appPresenceMode;

  const value = useMemo<LocationContextType>(
    () => ({
      locationMode,
      appPresenceMode,
      effectivePresenceMode,
      currentLocationName,
      homeLocation,
      gpsGranted,
      hasCompletedSetup,
      hasSelectedStartMode,
      setHomeLocation,
      chooseStartMode,
      requestGpsPermission,
      refreshLocation,
    }),
    [
      locationMode,
      appPresenceMode,
      effectivePresenceMode,
      currentLocationName,
      homeLocation,
      gpsGranted,
      hasCompletedSetup,
      hasSelectedStartMode,
      setHomeLocation,
      chooseStartMode,
      requestGpsPermission,
      refreshLocation,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
