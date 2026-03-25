import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type HomeLocation = {
  name: string;
  lat: number;
  lng: number;
};

export type LocationMode = "live" | "home" | "pending";

type LocationContextType = {
  locationMode: LocationMode;
  currentLocationName: string | null;
  homeLocation: HomeLocation | null;
  gpsGranted: boolean;
  hasCompletedSetup: boolean;
  setHomeLocation: (loc: HomeLocation) => Promise<void>;
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
  const [homeLocation, setHomeLocationState] = useState<HomeLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("pending");
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  useEffect(() => {
    loadSaved();
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
            setCurrentLocationName(home.name);
            setLocationMode("home");
            return;
          }
        }

        // Away from home → reverse geocode to city/district level
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const name = [place.district || place.subregion, place.city]
          .filter(Boolean)
          .join(", ");
        setCurrentLocationName(name || place.city || "Nearby");
        setLocationMode("live");
      } catch (_) {
        if (home) {
          setCurrentLocationName(home.name);
          setLocationMode("home");
        }
      }
    },
    []
  );

  const loadSaved = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.homeLocation) {
        setHomeLocationState(data.homeLocation);
        setHasCompletedSetup(true);
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          setGpsGranted(true);
          await detectCurrentLocation(data.homeLocation);
        } else {
          // No GPS permission → fall back to home location
          setCurrentLocationName(data.homeLocation.name);
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
      setCurrentLocationName(loc.name);
      setLocationMode("home");
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    if (gpsGranted) {
      await detectCurrentLocation(homeLocation);
    }
  }, [gpsGranted, homeLocation, detectCurrentLocation]);

  return (
    <LocationContext.Provider
      value={{
        locationMode,
        currentLocationName,
        homeLocation,
        gpsGranted,
        hasCompletedSetup,
        setHomeLocation,
        requestGpsPermission,
        refreshLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
