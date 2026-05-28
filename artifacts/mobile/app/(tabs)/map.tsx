import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import Colors from "@/constants/colors";
import { Group, Party, PartyMember, useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useProximity } from "@/context/ProximityContext";
import { supabase } from "@/lib/supabase";
import type { WebView as WebViewType } from "react-native-webview";

const MAP_RADIUS_DEGREES = 0.06; // roughly 6-7km
const MAP_QUERY_LIMIT = 250;
const MAP_REFRESH_MS = 30000;
const FRIEND_REFRESH_MS = 90000;
const PRESENCE_HEARTBEAT_MS = 30000;
const ONLINE_STALE_MINUTES = 20;
const LIVE_POI_REFRESH_MS = 5 * 60 * 1000;
const LIVE_POI_RADIUS_METERS = 1800;
const LIVE_POI_LIMIT = 180;
const DEV_SIMULATED_STRANGER_COUNT = 50;
const DEV_SIMULATED_FRIEND_COUNT = 10;
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Mock seed parties (relative to home location)
const MOCK_PARTY_SEEDS = [
  {
    name: "Rooftop Vibes 🌇",
    dLat: 0.004,
    dLng: 0.003,
    memberOffsets: [
      { dx: 0.00015, dy: 0.00020 },
      { dx: -0.00020, dy: 0.00010 },
      { dx: 0.00010, dy: -0.00015 },
      { dx: -0.00008, dy: -0.00018 },
      { dx: 0.00025, dy: 0.00005 },
    ],
  },
  {
    name: "Block Party 🎶",
    dLat: -0.005,
    dLng: -0.003,
    memberOffsets: [
      { dx: 0.00020, dy: 0.00010 },
      { dx: -0.00015, dy: 0.00025 },
      { dx: 0.00005, dy: -0.00020 },
      { dx: -0.00022, dy: -0.00008 },
      { dx: 0.00018, dy: 0.00022 },
      { dx: -0.00010, dy: 0.00015 },
      { dx: 0.00012, dy: -0.00025 },
      { dx: -0.00025, dy: 0.00003 },
    ],
  },
];

const PARTY_COLORS = {
  fill: Colors.map.partyFill,
  shadow: Colors.map.partyShadow,
  circle: Colors.map.partyFill,
};

type MapFilterMode = "all" | "people" | "friends" | "dating";
type MapPresenceMode = "online" | "friend" | "relationship";

type MapUser = {
  lat: number;
  lng: number;
  name: string;
  id: string;
  avatarUrl?: string;
  intent: "active" | "friend" | "relationship";
  isFriend?: boolean;
};

type LivePoiCategory = "transit" | "school" | "worship" | "food" | "shop" | "green";

type LivePoi = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: LivePoiCategory;
  poiType?: string;
};

type MapParty = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hostName: string;
  members: { id: string; name: string; lat: number; lng: number }[];
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function areMapUsersEqual(a: MapUser[], b: MapUser[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.intent !== y.intent ||
      x.avatarUrl !== y.avatarUrl ||
      x.isFriend !== y.isFriend ||
      Math.abs(x.lat - y.lat) > 0.000001 ||
      Math.abs(x.lng - y.lng) > 0.000001
    ) {
      return false;
    }
  }
  return true;
}

function areLivePoisEqual(a: LivePoi[], b: LivePoi[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.category !== y.category ||
      x.poiType !== y.poiType ||
      Math.abs(x.lat - y.lat) > 0.000001 ||
      Math.abs(x.lng - y.lng) > 0.000001
    ) {
      return false;
    }
  }
  return true;
}

function GroupSwipeCard({
  group,
  isOpen,
  onPress,
  onDelete,
}: {
  group: Group;
  isOpen: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetXRef = useRef(0);
  const dragXRef = useRef(0);
  const didSwipeLeftRef = useRef(false);
  const deleteWidth = 54;
  const swipeStartThreshold = 2;

  const snapTo = useCallback((value: number) => {
    offsetXRef.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [translateX]);

  const snapOpen = useCallback(() => {
    offsetXRef.current = -deleteWidth;
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: -deleteWidth - 8,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: -deleteWidth,
        useNativeDriver: true,
        damping: 12,
        stiffness: 180,
        mass: 0.7,
      }),
    ]).start();
  }, [translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > swipeStartThreshold && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragXRef.current = offsetXRef.current;
          didSwipeLeftRef.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(-deleteWidth, Math.min(0, offsetXRef.current + gesture.dx));
          dragXRef.current = next;
          if (gesture.dx < 0 || next < offsetXRef.current) {
            didSwipeLeftRef.current = true;
          }
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldReveal = didSwipeLeftRef.current || gesture.dx < 0 || gesture.vx < -0.05;
          const shouldClose = gesture.dx > 0 || gesture.vx > 0.05;
          if (!shouldReveal && !shouldClose) {
            snapTo(offsetXRef.current);
            return;
          }
          if (shouldReveal) {
            snapOpen();
          } else {
            snapTo(0);
          }
        },
        onPanResponderTerminate: () => {
          if (didSwipeLeftRef.current || dragXRef.current < 0) {
            snapOpen();
          } else {
            snapTo(offsetXRef.current);
          }
        },
      }),
    [snapOpen, snapTo, swipeStartThreshold, translateX],
  );

  return (
    <View style={styles.groupSwipeRow}>
      <Pressable
        style={styles.groupDeleteAction}
        onPress={() => {
          snapTo(0);
          onDelete();
        }}
      >
        <Feather name="x" size={18} color="#fff" />
      </Pressable>
      <Animated.View style={[styles.groupSwipeFront, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable
          style={styles.myPartyCard}
          onPress={() => {
            if (offsetXRef.current < 0) return;
            onPress();
          }}
        >
          <View style={styles.groupCardIcon}>
            <Feather name="users" size={15} color={Colors.light.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.myPartyCardName} numberOfLines={1}>{group.name}</Text>
            <Text style={styles.myPartyCardSub}>
              {group.members.length} Mitglied{group.members.length !== 1 ? "er" : ""}
            </Text>
          </View>
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function PartySwipeCard({
  party,
  isOpen,
  onPress,
  onDelete,
}: {
  party: Party;
  isOpen: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetXRef = useRef(0);
  const dragXRef = useRef(0);
  const didSwipeLeftRef = useRef(false);
  const deleteWidth = 54;
  const swipeStartThreshold = 2;

  const snapTo = useCallback((value: number) => {
    offsetXRef.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [translateX]);

  const snapOpen = useCallback(() => {
    offsetXRef.current = -deleteWidth;
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: -deleteWidth - 8,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: -deleteWidth,
        useNativeDriver: true,
        damping: 12,
        stiffness: 180,
        mass: 0.7,
      }),
    ]).start();
  }, [translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > swipeStartThreshold && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragXRef.current = offsetXRef.current;
          didSwipeLeftRef.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(-deleteWidth, Math.min(0, offsetXRef.current + gesture.dx));
          dragXRef.current = next;
          if (gesture.dx < 0 || next < offsetXRef.current) {
            didSwipeLeftRef.current = true;
          }
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldReveal = didSwipeLeftRef.current || gesture.dx < 0 || gesture.vx < -0.05;
          const shouldClose = gesture.dx > 0 || gesture.vx > 0.05;
          if (!shouldReveal && !shouldClose) {
            snapTo(offsetXRef.current);
            return;
          }
          if (shouldReveal) {
            snapOpen();
          } else {
            snapTo(0);
          }
        },
        onPanResponderTerminate: () => {
          if (didSwipeLeftRef.current || dragXRef.current < 0) {
            snapOpen();
          } else {
            snapTo(offsetXRef.current);
          }
        },
      }),
    [snapOpen, snapTo, swipeStartThreshold, translateX],
  );

  return (
    <View style={styles.groupSwipeRow}>
      <Pressable
        style={styles.groupDeleteAction}
        onPress={() => {
          snapTo(0);
          onDelete();
        }}
      >
        <Feather name="x" size={18} color="#fff" />
      </Pressable>
      <Animated.View style={[styles.groupSwipeFront, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable
          style={styles.myPartyCard}
          onPress={() => {
            if (offsetXRef.current < 0) return;
            onPress();
          }}
        >
          <Text style={styles.myPartyCardEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.myPartyCardName} numberOfLines={1}>{party.name}</Text>
            <Text style={styles.myPartyCardSub}>
              {party.members.length} Mitglied{party.members.length !== 1 ? "er" : ""}
            </Text>
          </View>
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}


const FILTER_OPTIONS: { mode: MapFilterMode; label: string; icon: string }[] = [
  { mode: "all", label: "Alles", icon: "◎" },
  { mode: "people", label: "Menschen", icon: "◉" },
  { mode: "friends", label: "Freunde", icon: "★" },
  { mode: "dating", label: "Kennenlernen", icon: "♥" },
];

const PRESENCE_OPTIONS: {
  mode: MapPresenceMode;
  label: string;
  icon: string;
  color: string;
  background: string;
}[] = [
  { mode: "online", label: "Online", icon: "●", color: Colors.light.tint, background: Colors.light.backgroundTertiary },
  { mode: "friend", label: "Freunde", icon: "♥", color: Colors.light.mint, background: Colors.light.backgroundTertiary },
  { mode: "relationship", label: "Beziehung", icon: "♥", color: Colors.light.danger, background: Colors.light.backgroundTertiary },
];

type PresenceRow = {
  profile_id: string;
  lat: number | null;
  lng: number | null;
  mode: MapPresenceMode;
  is_online: boolean;
  last_seen_at: string;
  profiles:
    | {
        id: string;
        display_name: string;
        avatar_url: string | null;
      }
    | {
        id: string;
        display_name: string;
        avatar_url: string | null;
      }[]
    | null;
};

type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

function PartyPopperIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5.1 5.2h6.7c-.2 2.6-1.6 4.8-3.4 5.6C6.7 10 5.3 7.8 5.1 5.2Z"
        fill={Colors.light.yellow}
        stroke={Colors.light.onBright}
        strokeLinejoin="round"
        strokeWidth="1.3"
        transform="rotate(-22 8.45 8)"
      />
      <Path
        d="M12.2 5.2h6.7c-.2 2.6-1.6 4.8-3.4 5.6-1.7-.8-3.1-3-3.3-5.6Z"
        fill={Colors.light.yellow}
        stroke={Colors.light.onBright}
        strokeLinejoin="round"
        strokeWidth="1.3"
        transform="rotate(22 15.55 8)"
      />
      <Path
        d="M8.4 10.7v6.4M15.6 10.7v6.4M5.9 18.6h5M13.1 18.6h5"
        stroke={Colors.light.onBright}
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <Path
        d="M6.2 7.2h4.1M13.7 7.2h4.1"
        stroke={Colors.light.backgroundSecondary}
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <Path
        d="M7.2 3.9 8.5 7.2M16.8 3.9l-1.3 3.3"
        stroke={Colors.light.onBright}
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <Path
        d="M11.2 3.8h1.6M12 3v1.6M4.2 4.1l1 .8M19.8 4.1l-1 .8"
        stroke={Colors.light.tintBlue}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <Circle cx="3.8" cy="10.3" fill={Colors.light.mint} r="0.9" />
      <Circle cx="20.2" cy="10.3" fill={Colors.light.danger} r="0.9" />
      <Circle cx="5.1" cy="15.3" fill={Colors.light.tintBlue} r="0.8" />
      <Circle cx="18.9" cy="15.3" fill={Colors.light.yellow} r="0.8" />
    </Svg>
  );
}

function detectLivePoiCategory(tags: Record<string, string>): LivePoiCategory | null {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const publicTransport = tags.public_transport ?? "";
  const highway = tags.highway ?? "";
  const railway = tags.railway ?? "";

  if (
    amenity === "bus_station" ||
    amenity === "bus_stop" ||
    publicTransport === "platform" ||
    highway === "bus_stop" ||
    railway === "tram_stop" ||
    railway === "station"
  ) {
    return "transit";
  }
  if (
    amenity === "school" ||
    amenity === "college" ||
    amenity === "university" ||
    amenity === "kindergarten"
  ) {
    return "school";
  }
  if (amenity === "place_of_worship") {
    return "worship";
  }
  if (
    amenity === "cafe" ||
    amenity === "restaurant" ||
    amenity === "bar" ||
    amenity === "fast_food"
  ) {
    return "food";
  }
  if (shop) {
    return "shop";
  }
  if (
    tags.leisure === "park" ||
    tags.leisure === "garden" ||
    tags.leisure === "nature_reserve" ||
    tags.leisure === "recreation_ground" ||
    tags.landuse === "grass" ||
    tags.landuse === "meadow" ||
    tags.landuse === "forest" ||
    tags.landuse === "village_green" ||
    tags.natural === "wood"
  ) {
    return "green";
  }
  return null;
}

function toLivePoi(element: OverpassElement): LivePoi | null {
  const tags = element.tags ?? {};
  const category = detectLivePoiCategory(tags);
  if (!category) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat == null || lng == null) return null;

  const name =
    tags.name ||
    tags["name:en"] ||
    (category === "shop"
      ? "Shop"
      : category === "food"
        ? "Essen & Trinken"
        : category === "green"
          ? "Grünfläche"
        : category === "worship"
          ? "Kirche"
          : category === "school"
            ? "Schule"
            : "Haltestelle");

  return {
    id: `${element.type}-${element.id}`,
    lat,
    lng,
    name,
    category,
    poiType:
      tags.shop ||
      tags.amenity ||
      tags.leisure ||
      tags.landuse ||
      tags.natural ||
      tags.public_transport ||
      tags.highway ||
      tags.railway ||
      undefined,
  };
}

function buildFallbackLivePois(homeLocation: { lat: number; lng: number }): LivePoi[] {
  const seed: Array<Omit<LivePoi, "lat" | "lng"> & { dLat: number; dLng: number }> = [
    { id: "fallback-park", name: "Pocket Park", category: "green", poiType: "park", dLat: 0.0018, dLng: -0.0012 },
    { id: "fallback-bus", name: "Market Stop", category: "transit", poiType: "bus_stop", dLat: 0.0011, dLng: 0.0017 },
    { id: "fallback-cafe", name: "Neon Coffee", category: "food", poiType: "cafe", dLat: 0.00035, dLng: -0.00018 },
    { id: "fallback-restaurant", name: "Corner Kitchen", category: "food", poiType: "restaurant", dLat: 0.00036, dLng: -0.00015 },
    { id: "fallback-burger", name: "Late Burger", category: "food", poiType: "fast_food", dLat: 0.00032, dLng: -0.00012 },
    { id: "fallback-market", name: "Local Market", category: "shop", poiType: "supermarket", dLat: 0.00028, dLng: -0.0002 },
    { id: "fallback-kiosk", name: "Night Kiosk", category: "shop", poiType: "convenience", dLat: 0.00029, dLng: -0.00016 },
    { id: "fallback-bakery", name: "Morning Bakery", category: "shop", poiType: "bakery", dLat: 0.00031, dLng: -0.00024 },
    { id: "fallback-books", name: "Tiny Books", category: "shop", poiType: "books", dLat: 0.00022, dLng: -0.00014 },
    { id: "fallback-pharmacy", name: "City Pharmacy", category: "shop", poiType: "pharmacy", dLat: -0.00038, dLng: 0.0002 },
    { id: "fallback-school", name: "Local School", category: "school", poiType: "school", dLat: -0.0015, dLng: 0.001 },
    { id: "fallback-worship", name: "Neighborhood Church", category: "worship", poiType: "place_of_worship", dLat: -0.0011, dLng: -0.0016 },
  ];

  return seed
    .map((poi) => ({
      id: poi.id,
      lat: homeLocation.lat + poi.dLat,
      lng: homeLocation.lng + poi.dLng,
      name: poi.name,
      category: poi.category,
      poiType: poi.poiType,
    }))
    .sort((a, b) => `${a.category}|${a.name}|${a.id}`.localeCompare(`${b.category}|${b.name}|${b.id}`));
}

function applyFallbackLivePois(
  setLivePois: React.Dispatch<React.SetStateAction<LivePoi[]>>,
  homeLocation: { lat: number; lng: number },
) {
  const fallbackPois = buildFallbackLivePois(homeLocation);
  setLivePois((prev) => (prev.length ? prev : fallbackPois));
}

function computeNightFactor(now: Date): { nightFactor: number; dawnDuskFactor: number } {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 360 || m >= 1320) return { nightFactor: 1.0, dawnDuskFactor: 0 };       // 22:00–06:00 Nacht
  if (m < 480) { const t = (m - 360) / 120; return { nightFactor: 1 - t, dawnDuskFactor: Math.sin(t * Math.PI) }; } // 06:00–08:00 Morgenrot
  if (m < 1080) return { nightFactor: 0, dawnDuskFactor: 0 };                       // 08:00–18:00 Tag
  if (m < 1200) { const t = (m - 1080) / 120; return { nightFactor: t * 0.7, dawnDuskFactor: Math.sin(t * Math.PI) }; } // 18:00–20:00 Dämmerung
  const t = (m - 1200) / 120; return { nightFactor: 0.7 + t * 0.3, dawnDuskFactor: 0 }; // 20:00–22:00 Abend
}

function buildMapHtml(
  lat: number,
  lng: number,
  locationName: string,
  showDevMapTools: boolean
) {
  const mapStyle = Colors.map;
  const appColors = Colors.light;
  const isNeonStyle = Colors.activeStyle.id === "neon";
  const markerRadius = isNeonStyle ? "8px" : "50%";
  const smallMarkerRadius = isNeonStyle ? "5px" : "50%";
  const dev3dButtonHtml = showDevMapTools
    ? '<button id="dev-3d" aria-label="3D Ansicht" type="button">3D</button>'
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.js"></script>
  <style>
    :root {
      --ink: ${appColors.text};
      --paper: ${mapStyle.paper};
      --accent: ${appColors.tint};
      --mint: ${appColors.mint};
      --outline: ${appColors.text};
      --accent-blue: ${mapStyle.accentBlue};
      --accent-pink: ${mapStyle.accentPink};
      --accent-yellow: ${mapStyle.accentYellow};
      --building-low: ${mapStyle.buildingLow};
      --building-mid: ${mapStyle.buildingMid};
      --building-high: ${mapStyle.buildingHigh};
      --building-tall: ${mapStyle.buildingTall};
      --marker-radius: ${markerRadius};
      --small-marker-radius: ${smallMarkerRadius};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--paper); font-family: "Avenir Next", "Trebuchet MS", "Arial Rounded MT Bold", sans-serif; overflow: hidden; }
    #map { width: 100vw; height: 100vh; }
	    #parchment-overlay {
	      position: fixed;
	      inset: 0;
	      pointer-events: none;
	      z-index: 330;
	      background:
	        radial-gradient(circle at 12% 16%, ${mapStyle.overlayBlue} 0%, rgba(0, 240, 255, 0) 32%),
	        radial-gradient(circle at 84% 80%, ${mapStyle.overlayPink} 0%, rgba(255, 43, 214, 0) 36%),
	        radial-gradient(circle at 52% 42%, ${mapStyle.overlayYellow} 0%, rgba(239, 255, 58, 0) 38%);
	      mix-blend-mode: screen;
	    }
    #vignette {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 360;
	      box-shadow: inset 0 0 90px rgba(0, 0, 0, 0.46);
    }
    #recenter {
      position: fixed;
      right: 16px;
      bottom: 116px;
      width: 62px;
      height: 62px;
      border-radius: var(--marker-radius);
      border: 2px solid var(--outline);
      background:
        linear-gradient(135deg, rgba(0,240,255,0.24) 0%, rgba(255,43,214,0.22) 100%),
        #07131f;
      box-shadow: 0 0 0 1px rgba(0,240,255,0.45), 0 0 18px rgba(0,240,255,0.42);
      z-index: 500;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-blue);
      font-size: 25px;
      font-weight: 900;
      letter-spacing: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    #recenter:active {
      transform: translateY(2px);
      box-shadow: 0 0 10px rgba(255,43,214,0.42);
    }
    #recenter::before {
      content: "✦";
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      color: var(--accent-pink);
      font-size: 13px;
    }
	    .maplibregl-canvas {
	      filter: saturate(1.25) contrast(1.06) brightness(0.9);
	    }
    #dev-3d {
      position: fixed;
      right: 16px;
      bottom: 190px;
      min-width: 54px;
      height: 42px;
      border-radius: var(--marker-radius);
      border: 2px solid var(--outline);
      background: linear-gradient(135deg, rgba(255,43,214,0.22) 0%, rgba(0,240,255,0.24) 100%), #07131f;
      box-shadow: 0 0 16px rgba(255,43,214,0.4);
      z-index: 500;
      color: var(--accent-blue);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    #dev-3d:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 rgba(21, 34, 56, 0.32);
    }
	    .pulse { animation: pulse 2s infinite; }
	    @keyframes pulse {
	      0%   { opacity: 1; }
	      50%  { opacity: 0.68; }
	      100% { opacity: 1; }
	    }
    .party-pulse { animation: partyPulse 1.9s infinite; }
	    @keyframes partyPulse {
	      0%   { box-shadow: 0 0 0 0 rgba(255,43,214,0.9), 0 0 16px rgba(255,43,214,0.55); }
	      45%  { box-shadow: 0 0 0 14px rgba(255,43,214,0.34), 0 0 22px rgba(255,43,214,0.48); }
	      80%  { box-shadow: 0 0 0 25px rgba(255,43,214,0), 0 0 30px rgba(255,43,214,0.28); }
	      100% { box-shadow: 0 0 0 0 rgba(255,43,214,0), 0 0 16px rgba(255,43,214,0.45); }
	    }
	    .friend-pulse { animation: friendPulse 1.9s infinite; }
	    @keyframes friendPulse {
	      0%   { box-shadow: 0 0 0 0 rgba(239,255,58,0.92), 0 0 14px rgba(239,255,58,0.54); }
	      45%  { box-shadow: 0 0 0 13px rgba(239,255,58,0.36), 0 0 22px rgba(239,255,58,0.48); }
	      80%  { box-shadow: 0 0 0 24px rgba(239,255,58,0), 0 0 30px rgba(239,255,58,0.26); }
	      100% { box-shadow: 0 0 0 0 rgba(239,255,58,0), 0 0 14px rgba(239,255,58,0.42); }
	    }
    /* ── Walking Figures (Phase 1) ──────────────────────────────── */
    .fig-wrap {
      display: flex; flex-direction: column; align-items: center;
      transform-origin: 50% 50%; position: relative;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    }
    .fig {
      position: relative; display: flex; flex-direction: column; align-items: center;
      gap: 1px; cursor: pointer;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    }
    .fig.fig-me { min-width: 44px; min-height: 44px; justify-content: center; }
    .fig-glow {
      position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
      width: 30px; height: 8px; border-radius: 50%;
      background: radial-gradient(ellipse, rgba(239,255,58,0.42) 0%, transparent 70%);
      pointer-events: none; opacity: 0; transition: opacity 1.2s;
    }
    .fig-head {
      width: 13px; height: 13px; border-radius: 50%;
      background: #efff3a; border: 2px solid rgba(255,255,255,0.92); flex-shrink: 0; z-index: 2;
      box-shadow: 0 0 8px rgba(239,255,58,0.95), 0 0 18px rgba(239,255,58,0.55);
    }
    .fig-body {
      width: 5px; height: 8px; background: #efff3a; border-radius: 2px; flex-shrink: 0;
      box-shadow: 0 0 6px rgba(239,255,58,0.7);
    }
    .fig-legs { display: flex; gap: 3px; }
    .fig-leg {
      width: 3px; height: 9px; background: #efff3a; border-radius: 2px;
      transform-origin: 50% 0%; box-shadow: 0 0 4px rgba(239,255,58,0.6);
    }
    .fig.fig-me .fig-head { width: 16px; height: 16px; box-shadow: 0 0 12px rgba(239,255,58,1), 0 0 26px rgba(239,255,58,0.6); }
    .fig.fig-me .fig-body { width: 6px; height: 10px; }
    .fig.fig-me .fig-leg  { width: 4px; height: 11px; }
    .fig.fig-me ~ .fig-glow, .fig-wrap > .fig.fig-me + .fig-glow { display: none; }
    /* Idle */
    @keyframes fig-bob       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
    @keyframes fig-sway-l    { 0%,100%{transform:rotate(-9deg)} 50%{transform:rotate(9deg)} }
    @keyframes fig-sway-r    { 0%,100%{transform:rotate(9deg)} 50%{transform:rotate(-9deg)} }
    .fig[data-state="idle"] .fig-head,
    .fig[data-state="idle"] .fig-body { animation: fig-bob 2.2s ease-in-out infinite; }
    .fig[data-state="idle"] .fig-leg:first-child { animation: fig-sway-l 2.2s ease-in-out infinite; }
    .fig[data-state="idle"] .fig-leg:last-child  { animation: fig-sway-r 2.2s ease-in-out infinite; }
    /* Walk */
    @keyframes fig-walk-l    { 0%{transform:rotate(-33deg)} 50%{transform:rotate(33deg)} 100%{transform:rotate(-33deg)} }
    @keyframes fig-walk-r    { 0%{transform:rotate(33deg)} 50%{transform:rotate(-33deg)} 100%{transform:rotate(33deg)} }
    @keyframes fig-walk-body { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1px)} }
    .fig[data-state="walk"] .fig-leg:first-child { animation: fig-walk-l 0.54s ease-in-out infinite; }
    .fig[data-state="walk"] .fig-leg:last-child  { animation: fig-walk-r 0.54s ease-in-out infinite; }
    .fig[data-state="walk"] .fig-head,
    .fig[data-state="walk"] .fig-body { animation: fig-walk-body 0.54s ease-in-out infinite; }
    /* Run */
    .fig[data-state="run"] .fig-leg:first-child { animation: fig-walk-l 0.27s ease-in-out infinite; }
    .fig[data-state="run"] .fig-leg:last-child  { animation: fig-walk-r 0.27s ease-in-out infinite; }
    .fig[data-state="run"] .fig-head,
    .fig[data-state="run"] .fig-body { animation: fig-walk-body 0.27s ease-in-out infinite; }
    /* Phase 2: smooth GPS-updates via JS interpolation (keine CSS transition – würde Panning verlangsamen) */
    /* ── Inline-Popup (Teil der Figur, kein MapLibre Popup API) ── */
    @keyframes fig-popup-appear {
      from { transform: translateX(-50%) translateY(8px) scale(0.92); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0)   scale(1);    opacity: 1; }
    }
    .fig-popup-inner {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(7,19,31,0.97);
      border: 1.5px solid rgba(0,240,255,0.55);
      border-radius: 10px;
      box-shadow: 0 0 18px rgba(0,240,255,0.28);
      padding: 10px 14px;
      min-width: 160px;
      max-width: 210px;
      z-index: 200;
      display: none;
      pointer-events: auto;
    }
    .fig-popup-inner.visible {
      display: block;
      animation: fig-popup-appear 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .fig-popup-inner::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: rgba(0,240,255,0.55);
    }
    .fig-popup-name { color: #efff3a; font-size: 14px; font-weight: 900; display: block; margin-bottom: 3px; }
    .fig-popup-sub  { color: #00f0ff; font-size: 11px; font-weight: 700; display: block; }
    .fig-popup-link { color: #ff2bd6; font-size: 12px; font-weight: 800; cursor: pointer; display: block; margin-top: 7px; text-decoration: none; }
    /* ── Phase 3: Burst rings ───────────────────────────────────── */
    @keyframes burst-ring {
      0%   { transform: scale(1); opacity: 0.9; }
      100% { transform: scale(4); opacity: 0; }
    }
    .burst-ring {
      position: absolute; left: 50%; top: 50%;
      width: 22px; height: 22px; margin: -11px 0 0 -11px;
      border-radius: 50%; border: 2px solid #efff3a;
      pointer-events: none;
      animation: burst-ring 0.65s ease-out forwards;
    }
    /* ── Phase 3: Party confetti ────────────────────────────────── */
    @keyframes confetti-fly {
      0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
      100% { transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.3); opacity: 0; }
    }
    .confetti-dot {
      position: absolute; width: 5px; height: 5px; border-radius: 50%;
      pointer-events: none; z-index: 600;
      animation: confetti-fly 0.78s ease-out forwards;
      transform: translate(-50%,-50%);
    }
    /* ── Phase 3: Figure pop-in stagger ────────────────────────── */
    @keyframes fig-pop-in {
      0%   { transform: scale(0) translateY(8px); opacity: 0; }
      68%  { transform: scale(1.18) translateY(-2px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    .fig-entering { animation: fig-pop-in 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    /* ── Phase 4: Ambient particles ─────────────────────────────── */
    @keyframes ambient-float {
      0%   { transform: translate(0,0); opacity: var(--op); }
      50%  { opacity: calc(var(--op) * 1.7); }
      100% { transform: translate(var(--dx),var(--dy)); opacity: 0; }
    }
    .ambient-p {
      position: fixed; width: 2px; height: 2px; border-radius: 50%;
      pointer-events: none; z-index: 320;
      animation: ambient-float var(--dur) ease-in-out infinite alternate;
    }
    .popup { font-size: 13px; min-width: 130px; }
    .popup a  { display: block; color: var(--ink); font-weight: 800; cursor: pointer; text-decoration: none; }
	    .popup a:active { color: var(--accent); }
	    .popup strong { display: block; color: var(--ink); font-weight: 900; font-size: 14px; }
	    .popup span { color: var(--accent-blue); font-size: 11px; margin-top: 2px; display: block; font-weight: 700; }
	    .poi-anchor {
	      position: relative;
	      width: 0;
	      height: 0;
	      overflow: visible;
	    }
	    .poi-connector {
	      position: absolute;
	      left: 0;
	      top: -1px;
	      height: 2px;
	      border-radius: 999px;
	      background: linear-gradient(90deg, rgba(0,240,255,0.72), rgba(255,43,214,0.48));
		      opacity: 0.78;
	      transform-origin: 0 50%;
	      pointer-events: none;
	    }
	    .poi-origin-dot {
	      position: absolute;
	      left: -4px;
	      top: -4px;
	      width: 8px;
	      height: 8px;
	      border-radius: 999px;
	      border: 1px solid rgba(0,240,255,0.92);
	      background: rgba(7,19,31,0.88);
		      box-shadow: 0 0 5px rgba(0,240,255,0.48);
	      pointer-events: none;
	    }
	    .poi-badge {
	      position: absolute;
	      left: 0;
	      top: 0;
	      display: flex;
	      align-items: center;
	      justify-content: center;
	      pointer-events: auto;
		      will-change: transform;
	    }
	    .friend-name-tag {
	      padding: 2px 8px;
      border-radius: var(--marker-radius);
      border: 1px solid var(--accent-blue);
      background: rgba(7, 19, 31, 0.92);
	      box-shadow: 0 0 6px rgba(0,240,255,0.24);
      color: var(--ink);
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
      margin-bottom: 4px;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
    .friend-marker-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      transform-origin: 50% 100%;
    }
    .info-sheet {
      min-width: 200px;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: infoSheetPop 220ms ease-out;
    }
    @keyframes infoSheetPop {
      from { transform: translateY(10px) scale(0.94); opacity: 0; }
      to   { transform: translateY(0) scale(1); opacity: 1; }
    }
    .info-sheet-avatar {
      width: 42px;
      height: 42px;
      border-radius: var(--marker-radius);
      border: 1px solid var(--accent-blue);
      background: #07131f;
      object-fit: cover;
      flex-shrink: 0;
    }
    .info-sheet-icon {
      width: 42px;
      height: 42px;
      border-radius: var(--marker-radius);
      border: 1px solid var(--accent-blue);
      background: #07131f;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .info-sheet-title {
      font-size: 14px;
      font-weight: 900;
      color: var(--ink);
      line-height: 1.1;
    }
    .info-sheet-activity {
      margin-top: 4px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-blue);
      line-height: 1.2;
    }
    .maplibregl-popup-content {
      border-radius: var(--marker-radius);
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.32), 0 0 28px rgba(255, 43, 214, 0.18);
      border: 2px solid var(--outline);
      background: linear-gradient(180deg, rgba(7,19,31,0.98) 0%, rgba(8,28,43,0.98) 100%);
      padding: 10px 12px;
    }
    .maplibregl-popup-tip { border-top-color: var(--outline) !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="parchment-overlay"></div>
  <div id="vignette"></div>
  <button id="recenter" aria-label="Auf mich zentrieren" type="button">⌖</button>
  ${dev3dButtonHtml}
  <script>
    function postNativeMessage(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (_) {}
    }

    window.onerror = function(message, source, line, column) {
      postNativeMessage({
        type: 'map_error',
        message: String(message || 'Unbekannter Kartenfehler'),
        source: source || null,
        line: line || null,
        column: column || null
      });
      return false;
    };

    window.onunhandledrejection = function(event) {
      var reason = event && event.reason ? String(event.reason) : 'Unbekannte Promise-Ablehnung';
      postNativeMessage({ type: 'map_error', message: reason });
    };

    var initialZoom = 14;
    var baseStyle = {
      version: 8,
      sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap'
        },
        openmaptiles: {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet'
        }
      },
      layers: [
        { id: 'osm-raster', type: 'raster', source: 'osm' }
      ]
    };
    var markerRefs = [];
    var poiMarkerEntries = [];
    var poiVisibilityRaf = null;
    window._mapUsersById = {};

	    var map = new maplibregl.Map({
	      container: 'map',
	      style: baseStyle,
	      center: [${lng}, ${lat}],
	      zoom: initialZoom,
	      pitch: 0,
	      maxPitch: 60,
	      fadeDuration: 0,
	      attributionControl: false
	    });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.enable();
    map.doubleClickZoom.disable();

    var recenterButton = document.getElementById('recenter');
    if (recenterButton) {
      recenterButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        map.easeTo({
          center: [${lng}, ${lat}],
          zoom: Math.max(map.getZoom(), initialZoom),
          duration: 420
        });
      });
    }

    var dev3dButton = document.getElementById('dev-3d');
    if (dev3dButton) {
      dev3dButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
	        var isIn3D = map.getPitch() > 10;
	        dev3dButton.textContent = isIn3D ? '3D' : '2D';
        dev3dButton.setAttribute('aria-label', isIn3D ? '3D Ansicht' : '2D Ansicht');
        map.easeTo({
          center: map.getCenter(),
          zoom: isIn3D ? map.getZoom() : Math.max(map.getZoom(), 16),
          pitch: isIn3D ? 0 : 54,
          bearing: 0,
          duration: 480
        });
      });
	      map.on('pitchend', function() {
	        var isIn3D = map.getPitch() > 10;
	        dev3dButton.textContent = isIn3D ? '2D' : '3D';
	        dev3dButton.setAttribute('aria-label', isIn3D ? '2D Ansicht' : '3D Ansicht');
	      });
    }

    function clearMarkers() {
      markerRefs.forEach(function(marker) {
        try { marker.remove(); } catch (_) {}
      });
      markerRefs = [];
      poiMarkerEntries = [];
      if (poiVisibilityRaf) {
        window.cancelAnimationFrame(poiVisibilityRaf);
        poiVisibilityRaf = null;
      }
    }

    function pushMarker(marker) {
      markerRefs.push(marker);
      return marker;
    }

    function poiCategoryPriority(poi, visual) {
      var categoryRank = {
        green: 90,
        transit: 82,
        school: 76,
        worship: 70,
        food: 54,
        shop: 42
      };
      var rank = categoryRank[poi.category] || 40;
      var type = String((poi && poi.poiType) || '').toLowerCase();
      if (type === 'restaurant' || type === 'cafe' || type === 'bar') rank += 8;
      if (type === 'supermarket' || type === 'pharmacy') rank += 7;
      if (visual && visual.subtitle && visual.subtitle !== 'Shop') rank += 3;
      return rank;
    }

    function poiOffsetStrengthForZoom(zoom) {
      if (zoom >= 18.2) return 0;
      if (zoom <= 14.6) return 1;
      return Math.max(0, Math.min(1, (18.2 - zoom) / 3.6));
    }

    function poiClusterKey(poi) {
      var cellSize = 0.00115;
      return [
        Math.round(poi.lat / cellSize),
        Math.round(poi.lng / cellSize)
      ].join('|');
    }

    function poiOffsetForSlot(index, clusterSize, strength) {
      if (clusterSize <= 1 || strength <= 0.01) return { dx: 0, dy: 0 };
      var columns = Math.min(5, clusterSize);
      var col = index % columns;
      var row = Math.floor(index / columns);
      var gapX = 48;
      var gapY = 50;
      var centeredCol = col - ((columns - 1) / 2);
      return {
        dx: centeredCol * gapX * strength,
        dy: (-58 - row * gapY) * strength
      };
    }

    function applyPoiOffset(entry, dx, dy, zoom) {
      var badge = entry.badge || entry.element.__poiBadge;
      var connector = entry.connector || entry.element.__poiConnector;
      var originDot = entry.originDot || entry.element.__poiOriginDot;
      var size = entry.size || entry.element.__poiSize || 28;
      if (!badge || !connector) return;

      badge.style.transform = 'translate(' + (dx - size / 2) + 'px,' + (dy - size / 2) + 'px)';
      badge.style.opacity = zoom < 15.4 ? '0.94' : '1';

      var distance = Math.hypot(dx, dy);
      if (distance < 8) {
        connector.style.display = 'none';
        if (originDot) originDot.style.display = 'none';
        return;
      }
      if (originDot) originDot.style.display = 'block';
      connector.style.display = 'block';
      connector.style.width = distance + 'px';
      connector.style.opacity = String(Math.min(0.82, Math.max(0.25, distance / 120)));
      connector.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
    }

    function updatePoiMarkerVisibility() {
      if (!poiMarkerEntries.length) return;
      var zoom = map.getZoom();
      var offsetStrength = poiOffsetStrengthForZoom(zoom);
      var container = map.getContainer();
      var width = container ? container.clientWidth : 0;
      var height = container ? container.clientHeight : 0;

      poiMarkerEntries.forEach(function(entry) {
        var point = map.project([entry.poi.lng, entry.poi.lat]);
        var margin = 42;
        var visibleOnScreen =
          point.x >= -margin * 3 &&
          point.y >= -margin * 3 &&
          point.x <= width + margin * 3 &&
          point.y <= height + margin * 3;
        if (!visibleOnScreen) {
          entry.element.style.display = 'none';
          return;
        }
        var selected = poiOffsetForSlot(entry.offsetIndex, entry.clusterSize || 1, offsetStrength);
        entry.element.style.display = 'block';
        entry.element.style.opacity = '1';
        applyPoiOffset(entry, selected.dx, selected.dy, zoom);
      });
    }

    function schedulePoiMarkerVisibilityUpdate() {
      if (poiVisibilityRaf) window.cancelAnimationFrame(poiVisibilityRaf);
      poiVisibilityRaf = window.requestAnimationFrame(function() {
        poiVisibilityRaf = null;
        updatePoiMarkerVisibility();
      });
    }

    function resolveVectorSourceName() {
      var style = map.getStyle();
      if (!style || !style.sources) return null;
      var styleSources = style.sources || {};
      var sourceName = null;
      ['openmaptiles', 'maplibre', 'composite'].some(function(candidate) {
        if (styleSources[candidate]) {
          sourceName = candidate;
          return true;
        }
        return false;
      });
      return sourceName;
    }

    function addStyledPoiLayers() {
      var style = map.getStyle();
      if (!style || !style.layers) return;
      var sourceName = resolveVectorSourceName();
      if (!sourceName) return;

      var labelLayerId = null;
      for (var i = 0; i < style.layers.length; i += 1) {
        var layer = style.layers[i];
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      function addBadgeAndIcon(idPrefix, filterExpr, badgeColor, iconName, iconSize) {
        var badgeId = idPrefix + '-badge';
        var iconId = idPrefix + '-icon';
        var glowId = idPrefix + '-glow';

        if (!map.getLayer(glowId)) {
          map.addLayer(
            {
              id: glowId,
              type: 'circle',
              source: sourceName,
              'source-layer': 'poi',
              minzoom: 12,
              filter: filterExpr,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, 8,
                  16, 12
                ],
                'circle-color': badgeColor,
                'circle-opacity': 0.18
              }
            },
            labelLayerId
          );
        }

        if (!map.getLayer(badgeId)) {
          map.addLayer(
            {
              id: badgeId,
              type: 'circle',
              source: sourceName,
              'source-layer': 'poi',
              minzoom: 12,
              filter: filterExpr,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, 7,
                  16, 11
                ],
                'circle-color': badgeColor,
                'circle-stroke-color': '${appColors.text}',
                'circle-stroke-width': 1.2,
                'circle-opacity': 0.95
              }
            },
            labelLayerId
          );
        }

        if (!map.getLayer(iconId)) {
          map.addLayer(
            {
              id: iconId,
              type: 'symbol',
              source: sourceName,
              'source-layer': 'poi',
              minzoom: 12,
              filter: filterExpr,
              layout: {
                'icon-image': iconName,
                'icon-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, iconSize * 0.78,
                  16, iconSize
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
              }
            },
            labelLayerId
          );
        }
      }

      addBadgeAndIcon(
        'locals-styled-bus',
        [
          'any',
          ['==', ['get', 'class'], 'bus'],
          ['==', ['get', 'subclass'], 'bus_stop'],
          ['==', ['get', 'subclass'], 'tram_stop'],
          ['==', ['get', 'subclass'], 'bus_station'],
          ['==', ['get', 'subclass'], 'public_transport']
        ],
        '${mapStyle.accentYellow}',
        'bus',
        1.15
      );

      addBadgeAndIcon(
        'locals-styled-school',
        [
          'any',
          ['==', ['get', 'class'], 'school'],
          ['==', ['get', 'subclass'], 'school'],
          ['==', ['get', 'subclass'], 'kindergarten'],
          ['==', ['get', 'subclass'], 'university'],
          ['==', ['get', 'subclass'], 'college']
        ],
        '${mapStyle.accentBlue}',
        'college',
        1.12
      );

      addBadgeAndIcon(
        'locals-styled-church',
        [
          'any',
          ['==', ['get', 'class'], 'place_of_worship'],
          ['==', ['get', 'subclass'], 'place_of_worship'],
          ['==', ['get', 'subclass'], 'church']
        ],
        '${mapStyle.accentPink}',
        'religious-christian',
        1.08
      );

      addBadgeAndIcon(
        'locals-styled-cafe',
        [
          'any',
          ['==', ['get', 'class'], 'cafe'],
          ['==', ['get', 'class'], 'restaurant'],
          ['==', ['get', 'class'], 'bar'],
          ['==', ['get', 'subclass'], 'cafe'],
          ['==', ['get', 'subclass'], 'restaurant'],
          ['==', ['get', 'subclass'], 'fast_food']
        ],
        '${mapStyle.buildingTall}',
        'cafe',
        1.05
      );
    }

    function addStyledBuildings() {
      var style = map.getStyle();
      if (!style || !style.layers) return;
      var sourceName = resolveVectorSourceName();
      if (!sourceName) return;

      var labelLayerId = null;
      for (var i = 0; i < style.layers.length; i += 1) {
        var layer = style.layers[i];
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      try {
        if (!map.getLayer('locals-styled-building-shadow')) {
          map.addLayer(
            {
              id: 'locals-styled-building-shadow',
              type: 'fill',
              source: sourceName,
              'source-layer': 'building',
              minzoom: 13,
              paint: {
                'fill-color': '${appColors.text}',
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.12, 16, 0.26],
                'fill-translate': [3, 4],
                'fill-translate-anchor': 'viewport'
              }
            },
            labelLayerId
          );
        }

        if (!map.getLayer('locals-styled-building-fill')) {
          map.addLayer(
            {
              id: 'locals-styled-building-fill',
              type: 'fill',
              source: sourceName,
              'source-layer': 'building',
              minzoom: 13,
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'render_height'], 0],
                  0, '${mapStyle.buildingLow}',
                  40, '${mapStyle.buildingMid}',
                  120, '${mapStyle.buildingHigh}',
                  220, '${mapStyle.buildingTall}'
                ],
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.48, 16, 0.78]
              }
            },
            labelLayerId
          );
        }

        if (!map.getLayer('locals-styled-building-outline')) {
          map.addLayer(
            {
              id: 'locals-styled-building-outline',
              type: 'line',
              source: sourceName,
              'source-layer': 'building',
              minzoom: 13,
              paint: {
                'line-color': '${appColors.text}',
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.58, 16, 0.92],
                'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 1.35, 18, 1.9]
              }
            },
            labelLayerId
          );
        }
      } catch (err) {
        postNativeMessage({
          type: 'map_error',
          message: err && err.message ? err.message : String(err || 'Karten-Gebäude konnten nicht geladen werden')
        });
      }
    }

    function add3DBuildings() {
      var style = map.getStyle();
      if (!style || !style.layers) return;
      var sourceName = resolveVectorSourceName();
      if (!sourceName) return;

      var labelLayerId = null;
      for (var i = 0; i < style.layers.length; i += 1) {
        var layer = style.layers[i];
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      var extrusionColor = [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 0],
        0, '${mapStyle.buildingLow}',
        40, '${mapStyle.buildingMid}',
        120, '${mapStyle.buildingHigh}',
        220, '${mapStyle.buildingTall}'
      ];
      var extrusionHeight = [
        'interpolate',
        ['linear'],
        ['zoom'],
        13, 0,
        14, ['*', ['coalesce', ['get', 'render_height'], 0], 0.25],
        15, ['*', ['coalesce', ['get', 'render_height'], 0], 0.55],
        16, ['coalesce', ['get', 'render_height'], 0]
      ];
      var extrusionBase = ['coalesce', ['get', 'render_min_height'], 0];
      var extrusionOpacity = [
        'interpolate',
        ['linear'],
        ['zoom'],
        13, 0.18,
        15, 0.42,
        17, 0.62
      ];

      try {
        if (map.getLayer('building-3d')) {
          map.setPaintProperty('building-3d', 'fill-extrusion-color', extrusionColor);
          map.setPaintProperty('building-3d', 'fill-extrusion-height', extrusionHeight);
          map.setPaintProperty('building-3d', 'fill-extrusion-base', extrusionBase);
          map.setPaintProperty('building-3d', 'fill-extrusion-opacity', extrusionOpacity);
          return;
        }

	        if (!map.getLayer('locals-3d-buildings')) {
	          map.addLayer(
	            {
	              id: 'locals-3d-buildings',
	              type: 'fill-extrusion',
	              source: sourceName,
	              'source-layer': 'building',
	              minzoom: 13,
	              paint: {
                'fill-extrusion-color': extrusionColor,
                'fill-extrusion-height': extrusionHeight,
                'fill-extrusion-base': extrusionBase,
                'fill-extrusion-opacity': extrusionOpacity
              }
            },
            labelLayerId
          );
        }
      } catch (err) {
        postNativeMessage({
          type: 'map_error',
          message: err && err.message ? err.message : String(err || '3D-Buildings konnten nicht geladen werden')
        });
      }
    }

    var tapCount = 0;
    var tapTimer = null;

    function isMarkerOrPopupTap(target) {
      while (target && target !== document) {
        if (
          target.classList &&
          (
            target.classList.contains('maplibregl-marker') ||
            target.classList.contains('maplibregl-popup') ||
            target.classList.contains('maplibregl-ctrl')
          )
        ) {
          return true;
        }
        target = target.parentNode;
      }
      return false;
    }

    map.on('click', function(event) {
      document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });

      if (event.originalEvent && isMarkerOrPopupTap(event.originalEvent.target)) {
        return;
      }

      tapCount += 1;

      if (tapTimer) {
        clearTimeout(tapTimer);
      }

      tapTimer = setTimeout(function() {
        if (tapCount >= 3) {
          map.easeTo({ center: [event.lngLat.lng, event.lngLat.lat], zoom: initialZoom, duration: 320 });
        } else if (tapCount === 2) {
          var nextZoom = Math.min(map.getZoom() + 1, 18);
          map.easeTo({ center: [event.lngLat.lng, event.lngLat.lat], zoom: nextZoom, duration: 260 });
        }
        tapCount = 0;
        tapTimer = null;
      }, 260);
    });

    map.on('dragstart', function() {
      document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });
      markerRefs.forEach(function(marker) {
        try {
          var p = marker.getPopup && marker.getPopup();
          if (p && p.isOpen()) p.remove();
        } catch(_) {}
      });
    });

    // ── Event delegation ──────────────────────────────────────────────────────
    document.addEventListener('click', function(e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.getAttribute && t.getAttribute('data-user-id')) {
          e.preventDefault(); e.stopPropagation();
          var uid = t.getAttribute('data-user-id');
          var ud = (window._mapUsersById && window._mapUsersById[uid]) || {};
          postNativeMessage({ type: 'user_detail', id: uid, name: ud.name || '', avatarUrl: ud.avatarUrl || '', isFriend: !!ud.isFriend, activity: ud.activity || '' });
          return;
        }
        t = t.parentNode;
      }
    }, true);

    function popupHtml(title, subtitle, userId) {
      var link = userId
        ? '<a data-user-id="' + userId + '">' + title + '</a>'
        : '<strong>' + title + '</strong>';
      return '<div class="popup">' + link + '<span>' + subtitle + '</span></div>';
    }

    function infoSheetHtml(title, subtitle, iconHtml, userId, avatarSrc) {
      var outerAttrs = userId ? ' data-user-id="' + userId + '" style="cursor:pointer"' : '';
      var heading = '<div class="info-sheet-title">' + title + '</div>';
      var visual = avatarSrc
        ? '<img class="info-sheet-avatar" src="' + avatarSrc + '" alt="" />'
        : '<div class="info-sheet-icon">' + (iconHtml || 'ℹ️') + '</div>';
      return [
        '<div class="info-sheet"' + outerAttrs + '>',
        visual,
        '<div>',
        heading,
        '<div class="info-sheet-activity">' + subtitle + '</div>',
        '</div>',
        '</div>'
      ].join('');
    }

    // ── Game-layer helpers ────────────────────────────────────────
    function figureEl(isMe) {
      var wrap = document.createElement('div');
      wrap.className = 'fig-wrap';
      var fig = document.createElement('div');
      fig.className = isMe ? 'fig fig-me' : 'fig';
      fig.dataset.state = 'idle';
      var glow = document.createElement('div'); glow.className = 'fig-glow';
      var head = document.createElement('div'); head.className = 'fig-head';
      var body = document.createElement('div'); body.className = 'fig-body';
      var legs = document.createElement('div'); legs.className = 'fig-legs';
      var legL = document.createElement('div'); legL.className = 'fig-leg';
      var legR = document.createElement('div'); legR.className = 'fig-leg';
      legs.appendChild(legL); legs.appendChild(legR);
      fig.appendChild(glow); fig.appendChild(head); fig.appendChild(body); fig.appendChild(legs);
      wrap.appendChild(fig);
      return { wrap: wrap, fig: fig };
    }

    function setFigureState(figEl, speed, heading) {
      var state = (!speed || speed < 0.4) ? 'idle' : speed < 2.5 ? 'walk' : 'run';
      if (figEl.dataset.state !== state) figEl.dataset.state = state;
      if (heading != null && !isNaN(heading)) {
        figEl.parentElement.style.transform = 'rotate(' + heading.toFixed(1) + 'deg)';
      }
      var glow = figEl.querySelector('.fig-glow');
      if (glow) glow.style.opacity = (window._tod && window._tod.n > 0.3) ? String(Math.min(window._tod.n * 0.9, 1).toFixed(2)) : '0';
    }

    function triggerBurst(el) {
      if (!el) return;
      for (var bi = 0; bi < 4; bi++) {
        (function(delay) {
          var ring = document.createElement('div');
          ring.className = 'burst-ring';
          ring.style.animationDelay = delay + 's';
          el.appendChild(ring);
          setTimeout(function() { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 900);
        })(bi * 0.13);
      }
    }

    function triggerPartyConfetti(lat, lng) {
      if (!window.map) return;
      var pt = window.map.project([lng, lat]);
      var colors = ['#efff3a', '#00f0ff', '#ff2bd6', '#00ffb2', '#ff3864'];
      for (var ci = 0; ci < 12; ci++) {
        (function(idx) {
          var dot = document.createElement('div');
          dot.className = 'confetti-dot';
          var angle = (idx / 12) * Math.PI * 2;
          var dist = 28 + Math.random() * 36;
          dot.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
          dot.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
          dot.style.setProperty('--rot', (Math.random() * 360).toFixed(0) + 'deg');
          dot.style.background = colors[idx % colors.length];
          dot.style.left = pt.x.toFixed(1) + 'px';
          dot.style.top  = pt.y.toFixed(1) + 'px';
          dot.style.animationDelay = (idx * 0.038).toFixed(3) + 's';
          document.body.appendChild(dot);
          setTimeout(function() { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 1000);
        })(ci);
      }
    }

    function spawnAmbientParticles() {
      var colors = ['#efff3a', '#00f0ff', '#ff2bd6', '#00ffb2'];
      for (var ai = 0; ai < 22; ai++) {
        (function(idx) {
          var p = document.createElement('div');
          p.className = 'ambient-p';
          p.style.left = (Math.random() * 100).toFixed(1) + 'vw';
          p.style.top  = (Math.random() * 100).toFixed(1) + 'vh';
          p.style.background = colors[idx % colors.length];
          p.style.setProperty('--dur', (9 + Math.random() * 13).toFixed(1) + 's');
          p.style.setProperty('--dx', (Math.random() * 52 - 26).toFixed(1) + 'px');
          p.style.setProperty('--dy', (Math.random() * 52 - 26).toFixed(1) + 'px');
          p.style.setProperty('--op', (0.06 + Math.random() * 0.09).toFixed(2));
          p.style.animationDelay = (Math.random() * -13).toFixed(1) + 's';
          document.body.appendChild(p);
        })(ai);
      }
    }
    // ── End game-layer helpers ────────────────────────────────────

    function markerEl(size, background, border, shadow, innerHtml) {
      var el = document.createElement('div');
      el.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'border-radius:' + (size <= 16 ? 'var(--small-marker-radius)' : 'var(--marker-radius)'),
        'background:' + background,
        'border:' + border,
        'box-shadow:' + shadow,
        'display:flex',
        'align-items:center',
        'justify-content:center'
      ].join(';');
      if (innerHtml) el.innerHTML = innerHtml;
      return el;
    }

    function poiMarkerEl(size, background, border, shadow, innerHtml) {
      var root = document.createElement('div');
      root.className = 'poi-anchor';
      var connector = document.createElement('div');
      connector.className = 'poi-connector';
      var originDot = document.createElement('div');
      originDot.className = 'poi-origin-dot';
      var badge = document.createElement('div');
      badge.className = 'poi-badge';
      badge.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'border-radius:var(--marker-radius)',
        'background:' + background,
        'border:' + border,
        'box-shadow:' + shadow
      ].join(';');
      if (innerHtml) badge.innerHTML = innerHtml;
      root.appendChild(originDot);
      root.appendChild(connector);
      root.appendChild(badge);
      root.__poiBadge = badge;
      root.__poiConnector = connector;
      root.__poiOriginDot = originDot;
      root.__poiSize = size;
      return root;
    }

    function addLivePoiMarkers() {
      var pois = window._mapPois || [];
      if (!Array.isArray(pois) || pois.length === 0) return;

      var styles = {
        transit: {
          bg: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, #072c3a 100%)',
          border: '1px solid var(--accent-blue)',
          shadow: '0 0 12px rgba(0,240,255,0.42)',
          icon: '🚌',
          subtitle: 'Haltestelle'
        },
        school: {
          bg: 'linear-gradient(135deg, rgba(0,240,255,0.18) 0%, rgba(255,43,214,0.16) 100%)',
          border: '1px solid var(--accent-blue)',
          shadow: '0 0 12px rgba(0,240,255,0.38)',
          icon: '🏫',
          subtitle: 'Schule'
        },
        worship: {
          bg: 'linear-gradient(135deg, rgba(255,43,214,0.2) 0%, #2b1230 100%)',
          border: '1px solid var(--accent-pink)',
          shadow: '0 0 12px rgba(255,43,214,0.4)',
          icon: '⛪',
          subtitle: 'Kirche'
        },
        food: {
          bg: 'linear-gradient(135deg, rgba(239,255,58,0.22) 0%, #2a2d10 100%)',
          border: '1px solid var(--accent-yellow)',
          shadow: '0 0 12px rgba(239,255,58,0.35)',
          icon: '🍽️',
          subtitle: 'Essen & Trinken'
        },
        shop: {
          bg: 'linear-gradient(135deg, rgba(255,43,214,0.22) 0%, rgba(0,240,255,0.12) 100%)',
          border: '1px solid var(--accent-pink)',
          shadow: '0 0 12px rgba(255,43,214,0.38)',
          icon: '🛍️',
          subtitle: 'Shop'
        },
        green: {
          bg: 'linear-gradient(135deg, rgba(0,255,178,0.24) 0%, #073523 100%)',
          border: '1px solid var(--mint)',
          shadow: '0 0 12px rgba(0,255,178,0.35)',
          icon: '🌳🌲🌳',
          subtitle: 'Grünfläche'
        }
      };

      function resolvePoiVisual(poi, base) {
        var name = String((poi && poi.name) || '').toLowerCase();
        var type = String((poi && poi.poiType) || '').toLowerCase();
        var icon = base.icon;
        var subtitle = base.subtitle;

        if (poi.category === 'food') {
          if (type === 'cafe' || /cafe|kaffee|coffee/.test(name)) {
            icon = '☕';
            subtitle = 'Café';
          } else if (type === 'restaurant' || /restaurant|ristorante|wirtshaus/.test(name)) {
            icon = '🍽️';
            subtitle = 'Restaurant';
          } else if (type === 'fast_food' || /burger|pizza|kebab|döner|imbiss/.test(name)) {
            icon = '🍔';
            subtitle = 'Fast Food';
          } else if (type === 'bar' || /bar|pub/.test(name)) {
            icon = '🍺';
            subtitle = 'Bar';
          }
        } else if (poi.category === 'shop') {
          if (type === 'supermarket' || /lidl|aldi|edeka|rewe|supermarkt/.test(name)) {
            icon = '🛒';
            subtitle = 'Supermarkt';
          } else if (type === 'convenience' || /kiosk|späti/.test(name)) {
            icon = '🏪';
            subtitle = 'Kiosk';
          } else if (type === 'bakery' || /bäcker|baker/.test(name)) {
            icon = '🥐';
            subtitle = 'Bäckerei';
          } else if (type === 'clothes' || type === 'fashion' || /mode|fashion/.test(name)) {
            icon = '👕';
            subtitle = 'Kleidung';
          } else if (type === 'shoes' || /schuh/.test(name)) {
            icon = '👟';
            subtitle = 'Schuhe';
          } else if (type === 'jewelry' || /juwel|jewel/.test(name)) {
            icon = '💍';
            subtitle = 'Schmuck';
          } else if (type === 'electronics' || /electro|technik/.test(name)) {
            icon = '💻';
            subtitle = 'Elektronik';
          } else if (type === 'books' || /buch|book/.test(name)) {
            icon = '📚';
            subtitle = 'Buchladen';
          } else if (type === 'toy' || /toy|spielzeug/.test(name)) {
            icon = '🧸';
            subtitle = 'Spielzeug';
          } else if (type === 'florist' || /flower|blumen/.test(name)) {
            icon = '💐';
            subtitle = 'Blumenladen';
          } else if (type === 'hairdresser' || /friseur|hair/.test(name)) {
            icon = '✂️';
            subtitle = 'Friseur';
          } else if (type === 'beauty' || /beauty|kosmetik|nail/.test(name)) {
            icon = '💅';
            subtitle = 'Beauty';
          } else if (type === 'pharmacy' || /apotheke|pharma/.test(name)) {
            icon = '💊';
            subtitle = 'Apotheke';
          } else if (type === 'pet' || type === 'pet_grooming' || /pet|hund|tier/.test(name)) {
            icon = '🐾';
            subtitle = 'Tierladen';
          }
        }

        return {
          bg: base.bg,
          border: base.border,
          shadow: base.shadow,
          icon: icon,
          subtitle: subtitle
        };
      }

      var validPois = pois
        .filter(function(poi) {
          return typeof poi.lat === 'number' && typeof poi.lng === 'number';
        })
        .sort(function(a, b) {
          return String(a.category + '|' + a.name + '|' + a.id)
            .localeCompare(String(b.category + '|' + b.name + '|' + b.id));
        });
      var poiClusters = {};
      validPois.forEach(function(poi) {
        var key = poiClusterKey(poi);
        if (!poiClusters[key]) poiClusters[key] = [];
        poiClusters[key].push(poi);
      });
      Object.keys(poiClusters).forEach(function(key) {
        poiClusters[key]
          .sort(function(a, b) {
            return String(a.category + '|' + a.name + '|' + a.id)
              .localeCompare(String(b.category + '|' + b.name + '|' + b.id));
          })
          .forEach(function(poi, index) {
            poi.__offsetIndex = index;
            poi.__clusterSize = poiClusters[key].length;
          });
      });

      validPois.forEach(function(poi) {
        if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') return;
        var base = styles[poi.category] || styles.shop;
        var category = resolvePoiVisual(poi, base);
        var stableKey = String(poi.category + '|' + poi.name + '|' + poi.id);
        var poiEl = poiMarkerEl(
          28,
          'linear-gradient(135deg, rgba(0,0,0,0.96) 0%, rgba(6,10,16,0.98) 100%)',
          category.border,
          category.shadow + ', 0 0 0 1px rgba(0,0,0,0.92) inset',
          '<span style="font-size:15px; line-height:1;">' + category.icon + '</span>'
        );
        poiEl.style.cursor = 'pointer';

        var poiMarker = pushMarker(new maplibregl.Marker({ element: poiEl, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
          .setLngLat([poi.lng, poi.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setHTML(
            infoSheetHtml(poi.name || 'POI', category.subtitle, category.icon)
          ))
          .addTo(map));
        poiMarkerEntries.push({
          marker: poiMarker,
          element: poiEl,
          badge: poiEl.__poiBadge,
          connector: poiEl.__poiConnector,
          originDot: poiEl.__poiOriginDot,
          size: poiEl.__poiSize,
          poi: poi,
          offsetIndex: poi.__offsetIndex || 0,
          clusterSize: poi.__clusterSize || 1,
          stableKey: stableKey,
          priority: poiCategoryPriority(poi, category)
        });
      });
      schedulePoiMarkerVisibilityUpdate();
      window.setTimeout(schedulePoiMarkerVisibilityUpdate, 120);
    }

    function addPartyAndMemberMarkers() {
      var partyData = window._mapParties || [];
      var activePartyId = null;
      var partyReturnView = null;
      var partyAnimationToken = 0;
      var partyMemberMarkers = [];

      function updatePartyMemberVisibility() {
        var zoomOk = map.getZoom() >= 17;
        partyMemberMarkers.forEach(function(entry) {
          var show = zoomOk && activePartyId && entry.partyId === activePartyId;
          if (entry.element) {
            entry.element.style.display = show ? 'flex' : 'none';
          }
        });
      }

      map.on('zoomend', updatePartyMemberVisibility);
      map.on('moveend', updatePartyMemberVisibility);

      partyData.forEach(function(party) {
        var partyEl = markerEl(
          32,
          'linear-gradient(135deg, rgba(255,43,214,0.22) 0%,${PARTY_COLORS.fill} 100%)',
          '1px solid var(--accent-pink)',
          '0 0 18px ${PARTY_COLORS.shadow}',
          '🎉'
        );
        partyEl.style.cursor = 'pointer';
        partyEl.style.zIndex = '95';
        partyEl.className = 'party-pulse';

        function handlePartyClick(event) {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          }

          var token = partyAnimationToken + 1;
          partyAnimationToken = token;
          try { map.stop(); } catch (_) {}

          if (activePartyId === party.id && partyReturnView) {
            var returnView = partyReturnView;
            activePartyId = null;
            partyReturnView = null;
            updatePartyMemberVisibility();
            map.easeTo({
              center: returnView.center,
              zoom: returnView.zoom,
              pitch: returnView.pitch,
              bearing: returnView.bearing,
              duration: 700
            });
            return;
          }

          if (!partyReturnView) {
            partyReturnView = {
              center: map.getCenter(),
              zoom: map.getZoom(),
              pitch: map.getPitch(),
              bearing: map.getBearing()
            };
          }
          activePartyId = party.id;
          updatePartyMemberVisibility();
          map.easeTo({ center: [party.lng, party.lat], zoom: 17.5, duration: 700 });
          setTimeout(function() {
            if (partyAnimationToken === token && activePartyId === party.id) {
              updatePartyMemberVisibility();
            }
          }, 720);
        }

        partyEl.addEventListener('click', handlePartyClick);

        pushMarker(new maplibregl.Marker({ element: partyEl, anchor: 'center' })
          .setLngLat([party.lng, party.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 14 }).setHTML(
            infoSheetHtml(
              party.name,
              party.members.length + ' Mitglieder · von ' + party.hostName,
              '🎉'
            )
          ))
          .addTo(map));

        party.members.forEach(function(m) {
          var mEl = markerEl(
            13,
            'linear-gradient(135deg, var(--mint) 0%, var(--accent-blue) 100%)',
            '1px solid var(--ink)',
            '0 0 10px rgba(0,255,178,0.45)'
          );
          mEl.style.display = 'none';
          pushMarker(new maplibregl.Marker({ element: mEl, anchor: 'center' })
            .setLngLat([m.lng, m.lat])
            .setPopup(new maplibregl.Popup({ closeButton: false, offset: 8 }).setHTML(
              infoSheetHtml(m.name, 'Party-Mitglied', '🧑', m.id)
            ))
            .addTo(map));
          partyMemberMarkers.push({ partyId: party.id, element: mEl });
        });
      });

      updatePartyMemberVisibility();
    }

    function addUserMarkers() {
      var users = window._mapUsers || [];
      var currentFilter = window._mapFilter || 'all';
      var neonYellow = '#efff3a';
      var neonGreen = '#00ffb2';
      window._mapUsersById = {};
      if (!window._figureMarkers) window._figureMarkers = {};
      var seenFigureIds = {};

      users.forEach(function(u, uIdx) {
        var showDatingMarker = currentFilter === 'dating' && u.intent !== 'active';
        var isFriend = !!u.isFriend;
        var useFigure = isFriend && !showDatingMarker;

        var avatarSrc = u.avatarUrl
          ? u.avatarUrl
          : 'https://api.dicebear.com/9.x/thumbs/png?seed=' + encodeURIComponent(u.id || u.name || 'local');
        var activityText = u.intent === 'relationship'
          ? 'Gerade auf Beziehungssuche'
          : u.intent === 'friend'
            ? 'Gerade auf Freundesuche'
            : 'Gerade online unterwegs';
        window._mapUsersById[u.id] = { name: u.name || '', avatarUrl: avatarSrc, isFriend: isFriend, activity: activityText };

        if (useFigure) {
          seenFigureIds[u.id] = true;
          var motion = (window._mapMotion || {})[u.id] || {};
          var existing = window._figureMarkers[u.id];
          if (existing) {
            existing.marker.setLngLat([u.lng, u.lat]);
            setFigureState(existing.fig, motion.speed, motion.heading);
            return;
          }
          var fr = figureEl(false);
          var lbl = document.createElement('div');
          lbl.className = 'friend-name-tag';
          lbl.textContent = u.name || 'Freund';
          fr.wrap.insertBefore(lbl, fr.wrap.firstChild);
          setFigureState(fr.fig, motion.speed, motion.heading);
          fr.wrap.style.zIndex = '2';
          fr.wrap.style.animationDelay = (uIdx * 0.048) + 's';
          fr.wrap.classList.add('fig-entering');
          setTimeout(function(w){ w.classList.remove('fig-entering'); w.style.animationDelay = ''; }.bind(null, fr.wrap), 620);
          var fMarker = new maplibregl.Marker({ element: fr.wrap, anchor: 'center' })
            .setLngLat([u.lng, u.lat])
            .addTo(map);
          var inlinePopup = document.createElement('div');
          inlinePopup.className = 'fig-popup-inner';
          var pName = document.createElement('span');
          pName.className = 'fig-popup-name';
          pName.textContent = u.name || 'Freund';
          var pSub = document.createElement('span');
          pSub.className = 'fig-popup-sub';
          pSub.textContent = activityText;
          inlinePopup.appendChild(pName);
          inlinePopup.appendChild(pSub);
          if (u.id) {
            var pLink = document.createElement('a');
            pLink.className = 'fig-popup-link';
            pLink.textContent = 'Profil öffnen →';
            (function(uid) {
              pLink.addEventListener('click', function(e) {
                e.stopPropagation();
                postNativeMessage({type: 'user_detail', id: uid});
              });
            })(u.id);
            inlinePopup.appendChild(pLink);
          }
          fr.wrap.appendChild(inlinePopup);
          inlinePopup.addEventListener('click', function(e) { e.stopPropagation(); });
          fr.wrap.addEventListener('click', function(e) {
            if (e.target === fr.wrap) return;
            e.stopPropagation();
            var isVisible = inlinePopup.classList.contains('visible');
            document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });
            if (!isVisible) { inlinePopup.classList.add('visible'); }
          });
          window._figureMarkers[u.id] = { marker: fMarker, fig: fr.fig, wrap: fr.wrap };
          return;
        }

        var el = null;
        if (showDatingMarker) {
          var heartColor = u.intent === 'relationship' ? '#ff3864' : '#00ffb2';
          var heartBackground = u.intent === 'relationship' ? 'rgba(255,56,100,0.22)' : 'rgba(0,255,178,0.18)';
          el = markerEl(
            28,
            'linear-gradient(135deg,rgba(7,19,31,0.96) 0%,' + heartBackground + ' 100%)',
            '1px solid ' + heartColor,
            '0 0 14px ' + heartBackground,
            '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="' + heartColor + '" d="M12 21s-7.2-4.6-9.6-9.2C.7 8.5 2.6 4.5 6.3 4.2c2-.2 3.5.8 4.4 2.1.3.4.9.4 1.2 0 1-1.4 2.5-2.3 4.4-2.1 3.7.3 5.6 4.3 3.9 7.6C19.2 16.4 12 21 12 21z"/></svg>'
          );
          el.className = 'pulse';
        } else {
          var circleSize = isFriend ? 22 : 13;
          var circleColor = isFriend ? neonYellow : neonGreen;
          var circleGlow = isFriend ? 'rgba(239,255,58,0.44)' : 'rgba(0,255,178,0.38)';
          el = markerEl(circleSize, circleColor, '1px solid rgba(234,251,255,0.9)', '0 0 10px ' + circleGlow);
          if (isFriend) el.className = 'friend-pulse';
        }

        var subtitle = showDatingMarker
          ? (u.intent === 'relationship' ? 'Sucht eine Beziehung' : 'Sucht Freunde')
          : currentFilter === 'friends' ? 'Freund' : 'Gerade aktiv ↗';

        pushMarker(new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([u.lng, u.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setHTML(
            infoSheetHtml(u.name || 'Local', subtitle, '🧑', u.id, avatarSrc)
          ))
          .addTo(map));
      });

      // Stale Figuren-Marker entfernen
      Object.keys(window._figureMarkers).forEach(function(id) {
        if (!seenFigureIds[id]) {
          window._figureMarkers[id].marker.remove();
          delete window._figureMarkers[id];
        }
      });
    }

    function addMyMarker() {
      var myPresence = window._mapPresence || 'online';
      var myLat = (window._myCurrentPos && window._myCurrentPos.lat) || ${lat};
      var myLng = (window._myCurrentPos && window._myCurrentPos.lng) || ${lng};

      if (myPresence === 'friend' || myPresence === 'relationship') {
        if (window._myFigureMarker) {
          window._myFigureMarker.marker.remove();
          window._myFigureMarker = null;
        }
        var meHeartColor = myPresence === 'relationship' ? '#ff3864' : '#00ffb2';
        var meHeartBackground = myPresence === 'relationship' ? 'rgba(255,56,100,0.22)' : 'rgba(0,255,178,0.18)';
        var mePopupText = myPresence === 'relationship' ? 'Sucht eine Beziehung' : 'Sucht Freunde';
        var meEl = markerEl(
          42,
          'linear-gradient(135deg,rgba(7,19,31,0.96) 0%,' + meHeartBackground + ' 100%)',
          '2px solid ' + meHeartColor,
          '0 0 18px ' + meHeartBackground,
          '<svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="' + meHeartColor + '" d="M12 21s-7.2-4.6-9.6-9.2C.7 8.5 2.6 4.5 6.3 4.2c2-.2 3.5.8 4.4 2.1.3.4.9.4 1.2 0 1-1.4 2.5-2.3 4.4-2.1 3.7.3 5.6 4.3 3.9 7.6C19.2 16.4 12 21 12 21z"/></svg>'
        );
        meEl.style.zIndex = '90';
        pushMarker(new maplibregl.Marker({ element: meEl, anchor: 'center' })
          .setLngLat([myLng, myLat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 11 }).setHTML(infoSheetHtml('Du', mePopupText, '📍')))
          .addTo(map));
      } else {
        if (!window._myFigureMarker) {
          var meFr = figureEl(true);
          meFr.wrap.style.zIndex = '90';
          meFr.wrap.style.pointerEvents = 'none';
          meFr.fig.style.pointerEvents = 'auto';
          meFr.wrap.classList.add('fig-entering');
          setTimeout(function() { meFr.wrap.classList.remove('fig-entering'); }, 420);
          var mePopup = document.createElement('div');
          mePopup.className = 'fig-popup-inner';
          mePopup.innerHTML = '<span class="fig-popup-name">Du</span><span class="fig-popup-sub">Gerade online</span>';
          meFr.wrap.appendChild(mePopup);
          mePopup.addEventListener('click', function(e) { e.stopPropagation(); });
          meFr.fig.addEventListener('click', function(e) {
            e.stopPropagation();
            var isVisible = mePopup.classList.contains('visible');
            document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });
            if (!isVisible) { mePopup.classList.add('visible'); }
          });
          var meMarker = new maplibregl.Marker({ element: meFr.wrap, anchor: 'center' })
            .setLngLat([myLng, myLat])
            .addTo(map);
          window._myFigureMarker = { marker: meMarker, fig: meFr.fig, wrap: meFr.wrap };
        } else {
          window._myFigureMarker.marker.setLngLat([myLng, myLat]);
        }
      }
    }

    function renderMapLayersAndMarkers() {
	      clearMarkers();
      var currentFilter = window._mapFilter || 'all';
	      var hidePois = currentFilter === 'people' || currentFilter === 'friends' || currentFilter === 'dating';

	      addStyledBuildings();
	      add3DBuildings();
	      if (!hidePois) addLivePoiMarkers();
      addPartyAndMemberMarkers();
      addUserMarkers();
      addMyMarker();
    }

    map.on('style.load', function() {
      renderMapLayersAndMarkers();
      map.once('idle', schedulePoiMarkerVisibilityUpdate);
    });

    map.on('zoomend', schedulePoiMarkerVisibilityUpdate);
    map.on('pitchend', schedulePoiMarkerVisibilityUpdate);
    map.on('resize', schedulePoiMarkerVisibilityUpdate);

    map.on('error', function(errorEvent) {
      var msg = errorEvent && errorEvent.error && errorEvent.error.message
        ? errorEvent.error.message
        : 'Unbekannter MapLibre-Fehler';
      postNativeMessage({ type: 'map_error', message: msg });
    });

    window._mapUsers = [];
    window._mapPois = [];
    window._mapParties = [];
    window._mapFilter = 'all';
    window._mapPresence = 'online';
    window._mapMotion = {};
    window._figureMarkers = {};
    window._myFigureMarker = null;
    window._myCurrentPos = null;

    window.updateMapData = function(users, pois, parties, filter, presence, motionData) {
      window._mapUsers = users || [];
      window._mapPois = pois || [];
      window._mapParties = parties || [];
      window._mapFilter = filter || 'all';
      window._mapPresence = presence || 'online';
      window._mapMotion = motionData || {};
      if (window.map && window.map.isStyleLoaded()) {
        renderMapLayersAndMarkers();
        schedulePoiMarkerVisibilityUpdate();
      }
    };

    window.updateMyFigure = function(speed, heading, lat, lng) {
      window._myCurrentPos = { lat: lat, lng: lng };
      if (window._myFigureMarker) {
        window._myFigureMarker.marker.setLngLat([lng, lat]);
        setFigureState(window._myFigureMarker.fig, speed, heading);
      }
    };

    window.triggerProximityBurst = function(userId) {
      var entry = window._figureMarkers && window._figureMarkers[userId];
      if (entry) triggerBurst(entry.wrap);
    };

    window.triggerPartySpawn = function(lat, lng) {
      triggerPartyConfetti(lat, lng);
    };

    window.applyTimeOfDay = function(nightFactor, dawnDuskFactor) {
      window._tod = { n: nightFactor, d: dawnDuskFactor || 0 };
      var brightness = (0.9 - nightFactor * 0.42).toFixed(3);
      var saturation  = (1.25 + nightFactor * 0.35).toFixed(3);
      var contrast    = (1.06 + nightFactor * 0.14).toFixed(3);
      var vigOpacity  = (0.46 + nightFactor * 0.34).toFixed(3);
      var vigSize     = Math.round(90 + nightFactor * 50);
      var canvas = document.querySelector('.maplibregl-canvas');
      if (canvas) canvas.style.filter = 'brightness(' + brightness + ') saturate(' + saturation + ') contrast(' + contrast + ')';
      var vignette = document.getElementById('vignette');
      if (vignette) {
        vignette.style.boxShadow = 'inset 0 0 ' + vigSize + 'px rgba(0,0,0,' + vigOpacity + ')';
        if (dawnDuskFactor > 0.05) {
          var a = (dawnDuskFactor * 0.18).toFixed(3);
          vignette.style.background = 'radial-gradient(ellipse at 50% 100%, rgba(255,140,20,' + a + ') 0%, transparent 60%)';
        } else {
          vignette.style.background = '';
        }
      }
    };
    map.on('style.load', function() {
      if (window._tod) window.applyTimeOfDay(window._tod.n, window._tod.d);
    });

    spawnAmbientParticles();

  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { user } = useAuth();
  const { homeLocation, currentLocationName, effectivePresenceMode } = useLocation();
  const {
    posts,
    parties: storedParties,
    groups,
    createGroup,
    deleteGroup,
    updateGroupMembers,
    createParty,
    deleteParty,
    updatePartyMembers,
    currentUser,
    setMapFriends,
    addLocalMessage,
  } = useApp();
  const { nearbyUsers: radarUsers, radarSettings, myLiveLocation } = useProximity();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebViewType>(null);
  const injectMapDataRef = useRef<(() => void) | null>(null);
  const prevGpsRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const mySpeedRef = useRef<number>(0);
  const myHeadingRef = useRef<number | null>(null);
  const prevRadarIdsRef = useRef<Set<string>>(new Set());

  const injectRadar = useCallback(() => {
    if (!webViewRef.current) return;
    const radarLat = myLiveLocation?.lat ?? homeLocation?.lat;
    const radarLon = myLiveLocation?.lon ?? homeLocation?.lng;

    if (!radarSettings.enabled || radarLat == null || radarLon == null) {
      webViewRef.current.injectJavaScript(`
        (function() {
          if (!window.map) return;
          if (window.map.getLayer('radar-fill')) window.map.removeLayer('radar-fill');
          if (window.map.getLayer('radar-line')) window.map.removeLayer('radar-line');
          if (window.map.getSource('radar-radius')) window.map.removeSource('radar-radius');
        })(); true;
      `);
      return;
    }

    webViewRef.current.injectJavaScript(`
      (function() {
        if (!window.map) return;
        function drawRadar() {
          var lat = ${radarLat};
          var lon = ${radarLon};
          var radiusM = ${radarSettings.radiusM};
          if (window.map.getLayer('radar-fill')) window.map.removeLayer('radar-fill');
          if (window.map.getLayer('radar-line')) window.map.removeLayer('radar-line');
          if (window.map.getSource('radar-radius')) window.map.removeSource('radar-radius');
          var pts = 64;
          var coords = [];
          for (var i = 0; i <= pts; i++) {
            var angle = (i / pts) * 2 * Math.PI;
            var dLat = (radiusM / 111320) * Math.cos(angle);
            var dLon = (radiusM / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
            coords.push([lon + dLon, lat + dLat]);
          }
          window.map.addSource('radar-radius', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
          });
          window.map.addLayer({ id: 'radar-fill', type: 'fill', source: 'radar-radius',
            paint: { 'fill-color': '${Colors.light.tint}', 'fill-opacity': 0.06 }
          });
          window.map.addLayer({ id: 'radar-line', type: 'line', source: 'radar-radius',
            paint: { 'line-color': '${Colors.light.tint}', 'line-opacity': 0.45, 'line-width': 1.5, 'line-dasharray': [6, 4] }
          });
        }
        if (window.map.isStyleLoaded()) {
          drawRadar();
        } else {
          window.map.once('style.load', drawRadar);
        }
      })(); true;
    `);
  }, [homeLocation, myLiveLocation, radarSettings.enabled, radarSettings.radiusM]);

  useEffect(() => {
    injectRadar();
  }, [injectRadar]);

  const injectTimeOfDay = useCallback(() => {
    if (!webViewRef.current) return;
    const { nightFactor, dawnDuskFactor } = computeNightFactor(new Date());
    webViewRef.current.injectJavaScript(
      `(function(){if(window.applyTimeOfDay)window.applyTimeOfDay(${nightFactor.toFixed(3)},${dawnDuskFactor.toFixed(3)});})();true;`
    );
  }, []);

  const onMapLoad = useCallback(() => {
    injectRadar();
    injectTimeOfDay();
    injectMapDataRef.current?.();
  }, [injectRadar, injectTimeOfDay]);

  const [showPartyComposer, setShowPartyComposer] = useState(false);
  const [createComposerMode, setCreateComposerMode] = useState<"group" | "party" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [selectedPartyMemberIds, setSelectedPartyMemberIds] = useState<string[]>([]);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [groupDropdownId, setGroupDropdownId] = useState<string | null>(null);
  const [groupManageSubview, setGroupManageSubview] = useState<"add" | "remove" | null>(null);
  const [groupAddIds, setGroupAddIds] = useState<string[]>([]);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partyManageSubview, setPartyManageSubview] = useState<"add" | "remove" | null>(null);
  const [partyAddIds, setPartyAddIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<MapFilterMode>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [presenceMode, setPresenceMode] = useState<MapPresenceMode>("online");
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<MapUser[]>([]);
  const [livePois, setLivePois] = useState<LivePoi[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [isMapActive, setIsMapActive] = useState(false);
  const partyPanelAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const [selectedMapUser, setSelectedMapUser] = useState<{
    id: string; name: string; avatarUrl: string; isFriend: boolean; activity: string;
  } | null>(null);
  const [userPanelDraft, setUserPanelDraft] = useState("");
  const [userMediaModalOpen, setUserMediaModalOpen] = useState(false);
  const userPanelAnim = useRef(new Animated.Value(0)).current;
  const userPanelInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      setIsMapActive(true);
      return () => setIsMapActive(false);
    }, []),
  );

  // Phase 1+2: GPS → speed/heading → Figur-Update (smooth movement)
  useEffect(() => {
    if (!myLiveLocation || !webViewRef.current || !isMapActive) return;
    const { lat, lon } = myLiveLocation;
    const now = Date.now();
    const prev = prevGpsRef.current;
    if (prev) {
      const dt = (now - prev.time) / 1000;
      if (dt > 0.3) {
        const dLat = lat - prev.lat;
        const dLon = lon - prev.lon;
        const distM = Math.sqrt(dLat * dLat + dLon * dLon) * 111320;
        mySpeedRef.current = distM / dt;
        if (distM > 0.8) {
          myHeadingRef.current = Math.atan2(dLon, dLat) * 180 / Math.PI;
        }
      }
    }
    prevGpsRef.current = { lat, lon, time: now };
    const speed = mySpeedRef.current;
    const heading = myHeadingRef.current;
    const headingStr = heading != null ? heading.toFixed(1) : 'null';
    webViewRef.current.injectJavaScript(
      `(function(){if(window.updateMyFigure)window.updateMyFigure(${speed.toFixed(3)},${headingStr},${lat},${lon});})();true;`
    );
  }, [myLiveLocation, isMapActive]);

  // Phase 3: Proximity-Burst wenn ein neuer Nutzer in Reichweite erscheint
  useEffect(() => {
    if (!radarUsers || !webViewRef.current || !isMapActive) return;
    const currentIds = new Set(radarUsers.map((u) => u.entity_id));
    radarUsers.forEach((u) => {
      if (!prevRadarIdsRef.current.has(u.entity_id)) {
        webViewRef.current!.injectJavaScript(
          `(function(){if(window.triggerProximityBurst)window.triggerProximityBurst(${JSON.stringify(u.entity_id)});})();true;`
        );
      }
    });
    prevRadarIdsRef.current = currentIds;
  }, [radarUsers, isMapActive]);

  useEffect(() => {
    Animated.spring(partyPanelAnim, {
      toValue: showPartyComposer ? 1 : 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [partyPanelAnim, showPartyComposer]);

  useEffect(() => {
    Animated.spring(userPanelAnim, {
      toValue: selectedMapUser ? 1 : 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [userPanelAnim, selectedMapUser]);

  const allUsers = useMemo(() => {
    const seen = new Set<string>();
    const users: { id: string; name: string; avatar: string }[] = [];
    posts.forEach((p) => {
      if (!seen.has(p.user.id)) {
        seen.add(p.user.id);
        users.push({ id: p.user.id, name: p.user.name, avatar: p.user.avatar });
      }
    });
    return users;
  }, [posts]);

  const upsertOwnPresence = useCallback(async () => {
    if (!user) return;
    if (!homeLocation) return;

    const shouldBeOnline = effectivePresenceMode === "online";
    const { error } = await supabase.from("map_presence").upsert({
      profile_id: user.id,
      lat: homeLocation.lat,
      lng: homeLocation.lng,
      mode: presenceMode,
      is_online: shouldBeOnline,
      last_seen_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("map_presence upsert failed", error.message);
    }
  }, [effectivePresenceMode, homeLocation, presenceMode, user]);

  const fetchFriendIds = useCallback(async () => {
    if (!user) {
      setFriendIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .returns<FriendshipRow[]>();

    if (error) {
      console.warn("friendships fetch failed", error.message);
      return;
    }

    const ids = new Set<string>();
    (data ?? []).forEach((row) => {
      const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
      if (otherId && otherId !== user.id) ids.add(otherId);
    });
    setFriendIds((prev) => {
      if (prev.size === ids.size) {
        let same = true;
        prev.forEach((id) => {
          if (!ids.has(id)) same = false;
        });
        if (same) return prev;
      }
      return ids;
    });
  }, [user]);

  const fetchActiveUsers = useCallback(async () => {
    if (!user || !homeLocation) {
      setActiveUsers([]);
      return;
    }

    const now = Date.now();
    const staleBoundary = new Date(now - ONLINE_STALE_MINUTES * 60 * 1000).toISOString();
    const latMin = homeLocation.lat - MAP_RADIUS_DEGREES;
    const latMax = homeLocation.lat + MAP_RADIUS_DEGREES;
    const lngMin = homeLocation.lng - MAP_RADIUS_DEGREES;
    const lngMax = homeLocation.lng + MAP_RADIUS_DEGREES;

    const { data, error } = await supabase
      .from("map_presence")
      .select(
        "profile_id, lat, lng, mode, is_online, last_seen_at, profiles!inner(id, display_name, avatar_url)",
      )
      .eq("is_online", true)
      .gte("last_seen_at", staleBoundary)
      .gte("lat", latMin)
      .lte("lat", latMax)
      .gte("lng", lngMin)
      .lte("lng", lngMax)
      .order("last_seen_at", { ascending: false })
      .limit(MAP_QUERY_LIMIT)
      .returns<PresenceRow[]>();

    if (error) {
      console.warn("map_presence fetch failed", error.message);
      return;
    }

    const mapped: MapUser[] = [];
    (data ?? []).forEach((row) => {
      if (!row.is_online || row.lat == null || row.lng == null) return;
      if (row.profile_id === user.id) return;

      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      mapped.push({
        id: row.profile_id,
        lat: row.lat,
        lng: row.lng,
        name: profile?.display_name ?? "Local",
        avatarUrl: profile?.avatar_url ?? undefined,
        intent: row.mode === "online" ? "active" : row.mode ?? "active",
      });
    });

    mapped.sort((a, b) => a.id.localeCompare(b.id));
    setActiveUsers((prev) => (areMapUsersEqual(prev, mapped) ? prev : mapped));
  }, [homeLocation, user]);

  const fetchLivePois = useCallback(async () => {
    if (!homeLocation) {
      setLivePois([]);
      return;
    }

    const query = `[out:json][timeout:25];
(
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[shop];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[amenity~"school|university|college|kindergarten|bus_station|bus_stop|place_of_worship|cafe|restaurant|fast_food|bar"];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[public_transport=platform];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[highway=bus_stop];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[railway~"tram_stop|station"];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[leisure~"park|garden|nature_reserve|recreation_ground"];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[landuse~"grass|meadow|forest|village_green"];
  node(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[natural=wood];

  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[shop];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[amenity~"school|university|college|kindergarten|bus_station|place_of_worship|cafe|restaurant|fast_food|bar"];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[public_transport=platform];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[highway=bus_stop];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[railway~"tram_stop|station"];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[leisure~"park|garden|nature_reserve|recreation_ground"];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[landuse~"grass|meadow|forest|village_green"];
  way(around:${LIVE_POI_RADIUS_METERS},${homeLocation.lat},${homeLocation.lng})[natural=wood];
);
out center tags ${LIVE_POI_LIMIT};`;

    try {
      const response = await fetch(OVERPASS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        console.warn("live poi fetch failed", response.status);
        applyFallbackLivePois(setLivePois, homeLocation);
        return;
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const raw = payload.elements ?? [];

      const seen = new Set<string>();
      const parsed: LivePoi[] = [];
      raw.forEach((el) => {
        const poi = toLivePoi(el);
        if (!poi) return;
        const key = `${poi.category}|${poi.name}|${poi.lat.toFixed(5)}|${poi.lng.toFixed(5)}`;
        if (seen.has(key)) return;
        seen.add(key);
        parsed.push(poi);
      });
      const greens = parsed.filter((poi) => poi.category === "green");
      const nonGreens = parsed.filter((poi) => poi.category !== "green");
      const next = [...greens, ...nonGreens]
        .slice(0, LIVE_POI_LIMIT)
        .sort((a, b) =>
          `${a.category}|${a.name}|${a.id}`.localeCompare(`${b.category}|${b.name}|${b.id}`),
        );
      if (!next.length) {
        applyFallbackLivePois(setLivePois, homeLocation);
        return;
      }
      setLivePois((prev) => (areLivePoisEqual(prev, next) ? prev : next));
    } catch (error) {
      console.warn("live poi fetch exception", error);
      applyFallbackLivePois(setLivePois, homeLocation);
    }
  }, [homeLocation]);

  useEffect(() => {
    if (!user || !homeLocation || !isMapActive) return;
    void upsertOwnPresence();
    const interval = setInterval(() => {
      void upsertOwnPresence();
    }, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [homeLocation, isMapActive, upsertOwnPresence, user]);

  useEffect(() => {
    if (!user || !homeLocation || !isMapActive) {
      return;
    }

    void fetchActiveUsers();

    const interval = setInterval(() => {
      void fetchActiveUsers();
    }, MAP_REFRESH_MS);

    return () => clearInterval(interval);
  }, [fetchActiveUsers, homeLocation, isMapActive, user]);

  useEffect(() => {
    if (!user || !homeLocation || !isMapActive) {
      return;
    }

    void fetchFriendIds();
    const interval = setInterval(() => {
      void fetchFriendIds();
    }, FRIEND_REFRESH_MS);

    return () => clearInterval(interval);
  }, [fetchFriendIds, homeLocation, isMapActive, user]);

  useEffect(() => {
    if (!homeLocation || !isMapActive || filterMode === "people") {
      if (filterMode === "people") setLivePois((prev) => (prev.length ? [] : prev));
      return;
    }

    void fetchLivePois();
    const interval = setInterval(() => {
      void fetchLivePois();
    }, LIVE_POI_REFRESH_MS);

    return () => clearInterval(interval);
  }, [fetchLivePois, filterMode, homeLocation, isMapActive]);

  useEffect(() => {
    if (!isMapActive) return;
    injectTimeOfDay();
    const interval = setInterval(injectTimeOfDay, 60_000);
    return () => clearInterval(interval);
  }, [injectTimeOfDay, isMapActive]);


  // Combine mock seed parties + user-created parties
  const allParties = useMemo(() => {
    if (!homeLocation) return [];

    const mockParties = MOCK_PARTY_SEEDS.map((seed, si) => ({
      id: `mock-party-${si}`,
      name: seed.name,
      lat: homeLocation.lat + seed.dLat,
      lng: homeLocation.lng + seed.dLng,
      hostName: allUsers[si % Math.max(allUsers.length, 1)]?.name ?? "Unbekannt",
      members: seed.memberOffsets.map((off, mi) => {
        const u = allUsers[(si * 3 + mi) % Math.max(allUsers.length, 1)];
        return {
          id: u?.id ?? `pm-${si}-${mi}`,
          name: u?.name ?? `Gast ${mi + 1}`,
          lat: homeLocation.lat + seed.dLat + off.dx,
          lng: homeLocation.lng + seed.dLng + off.dy,
        };
      }),
    }));

    const userParties = storedParties.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      hostName: p.hostName,
      members: p.members,
    }));

    return [...mockParties, ...userParties];
  }, [homeLocation, allUsers, storedParties]);

	  const simulatedUsers = useMemo<MapUser[]>(() => {
	    if (!__DEV__ || !homeLocation) return [];
	    const total = DEV_SIMULATED_STRANGER_COUNT + DEV_SIMULATED_FRIEND_COUNT;
	    return Array.from({ length: total }, (_, index) => {
	      const isFriend = index < DEV_SIMULATED_FRIEND_COUNT;
	      const localIndex = isFriend ? index : index - DEV_SIMULATED_FRIEND_COUNT;
	      const ring = Math.floor(localIndex / 10);
	      const angle =
	        (localIndex / (isFriend ? DEV_SIMULATED_FRIEND_COUNT : DEV_SIMULATED_STRANGER_COUNT)) *
	          Math.PI *
	          2 +
	        ring * 0.57 +
	        (isFriend ? 0.22 : 0);
	      const radius = isFriend
	        ? 0.0032 + (index % 4) * 0.0011
	        : 0.0038 + ring * 0.00105 + (localIndex % 6) * 0.00042;
	      return {
        id: isFriend ? `sim-friend-${index + 1}` : `sim-local-${index - DEV_SIMULATED_FRIEND_COUNT + 1}`,
        name: isFriend ? `Freund ${index + 1}` : `Local ${index - DEV_SIMULATED_FRIEND_COUNT + 1}`,
        lat: homeLocation.lat + Math.sin(angle) * radius,
        lng: homeLocation.lng + Math.cos(angle) * radius,
        intent: "active",
        isFriend,
      };
    });
  }, [homeLocation]);

  const mapUsers = useMemo(
    () => [
      ...activeUsers.map((user) => ({ ...user, isFriend: friendIds.has(user.id) })),
      ...simulatedUsers,
    ],
    [activeUsers, friendIds, simulatedUsers],
  );

  const visibleUsers = useMemo(() => {
    if (filterMode === "friends") {
      return mapUsers.filter((u) => u.isFriend);
    }
    if (filterMode === "dating") {
      return mapUsers.filter((u) => u.intent !== "active");
    }
    return mapUsers;
  }, [filterMode, mapUsers]);


  const friendUsers = useMemo(
    () =>
      mapUsers
        .filter((u) => u.isFriend)
        .map((u) => ({
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl ?? `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(u.id)}`,
          activity:
            u.intent === "relationship"
              ? "Sucht eine Beziehung"
              : u.intent === "friend"
                ? "Sucht neue Freunde"
                : "Gerade online unterwegs",
        })),
    [mapUsers],
  );

  useEffect(() => {
    setMapFriends(friendUsers);
  }, [friendUsers, setMapFriends]);


  const partyPickerUsers = useMemo(() => {
    const activityLabel = (u: MapUser) =>
      u.intent === "relationship" ? "Sucht eine Beziehung"
      : u.intent === "friend" ? "Sucht neue Freunde"
      : "Gerade online unterwegs";
    return [...mapUsers]
      .sort((a, b) => (b.isFriend ? 1 : 0) - (a.isFriend ? 1 : 0))
      .map((u) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatarUrl ?? `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(u.id)}`,
        isFriend: !!u.isFriend,
        activity: activityLabel(u),
      }));
  }, [mapUsers]);

  const selectedPartyMembers = useMemo(
    () => partyPickerUsers.filter((u) => selectedPartyMemberIds.includes(u.id)),
    [partyPickerUsers, selectedPartyMemberIds]
  );

  const groupPickerUsers = useMemo(
    () => partyPickerUsers.filter((u) => u.isFriend),
    [partyPickerUsers]
  );

  const selectedGroupMembers = useMemo(
    () => groupPickerUsers.filter((u) => selectedGroupMemberIds.includes(u.id)),
    [groupPickerUsers, selectedGroupMemberIds]
  );

  const myParty = useMemo(
    () => storedParties.find((p) => p.hostId === currentUser.id) ?? null,
    [storedParties, currentUser.id]
  );

  const togglePartyMember = useCallback((id: string) => {
    setSelectedPartyMemberIds((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  }, []);

  const toggleGroupMember = useCallback((id: string) => {
    setSelectedGroupMemberIds((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  }, []);

  const html = useMemo(() => {
    if (!homeLocation) return null;
    return buildMapHtml(
      homeLocation.lat,
      homeLocation.lng,
      currentLocationName ?? homeLocation.name,
      __DEV__
    );
  }, [homeLocation, currentLocationName]);

  const injectMapData = useCallback(() => {
    if (!webViewRef.current) return;
    const script = `(function(){if(window.updateMapData)window.updateMapData(${JSON.stringify(visibleUsers)},${JSON.stringify(livePois)},${JSON.stringify(allParties)},${JSON.stringify(filterMode)},${JSON.stringify(presenceMode)});})();true;`;
    webViewRef.current.injectJavaScript(script);
  }, [visibleUsers, livePois, allParties, filterMode, presenceMode]);

  useEffect(() => {
    injectMapDataRef.current = injectMapData;
    if (isMapActive) injectMapData();
  }, [injectMapData, isMapActive]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "user_detail" && data.id) {
        setSelectedMapUser({ id: data.id, name: data.name ?? "", avatarUrl: data.avatarUrl ?? "", isFriend: !!data.isFriend, activity: data.activity ?? "" });
        setUserPanelDraft("");
        return;
      }
      if (data.type === "profile" && data.id) {
        router.push(`/user/${data.id}`);
        return;
      }
      if (data.type === "map_error") {
        console.warn("[MapWebView]", data.message ?? "Unbekannter Fehler");
      }
    } catch (_) {}
  }, []);

  const handleCreateParty = useCallback(async () => {
    if (effectivePresenceMode === "home") {
      Alert.alert(
        "Daheim-Modus",
        "Du bist gerade passiv unterwegs. Wechsle zu Online, um eine Party zu starten.",
      );
      return;
    }
    if (!homeLocation || !partyName.trim() || selectedPartyMembers.length === 0) return;

    let partyLat = homeLocation.lat + 0.00028;
    let partyLng = homeLocation.lng;

    if (partyAddress.trim()) {
      try {
        const results = await Location.geocodeAsync(partyAddress.trim());
        if (results.length > 0) {
          partyLat = results[0].latitude;
          partyLng = results[0].longitude;
        } else {
          Alert.alert("Adresse nicht gefunden", "Die eingegebene Adresse konnte nicht gefunden werden. Die Party wird an deinem Standort erstellt.");
        }
      } catch {
        Alert.alert("Geocoding-Fehler", "Die Adresse konnte nicht aufgelöst werden. Die Party wird an deinem Standort erstellt.");
      }
    }

    const members: PartyMember[] = selectedPartyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      lat: partyLat + (Math.random() - 0.5) * 0.0004,
      lng: partyLng + (Math.random() - 0.5) * 0.0004,
    }));

    createParty(partyName.trim(), partyLat, partyLng, members);

    // Immediately push the new party into the WebView without waiting for
    // the React re-render cycle, and navigate the map to the party location.
    if (webViewRef.current) {
      const newPartyForMap = {
        id: `user-preview-${Date.now()}`,
        name: partyName.trim(),
        lat: partyLat,
        lng: partyLng,
        hostName: currentUser.name,
        members,
      };
      const updatedParties = [...allParties, newPartyForMap];
      webViewRef.current.injectJavaScript(
        `(function(){
          if(window.updateMapData) window.updateMapData(
            ${JSON.stringify(visibleUsers)},
            ${JSON.stringify(livePois)},
            ${JSON.stringify(updatedParties)},
            ${JSON.stringify(filterMode)},
            ${JSON.stringify(presenceMode)}
          );
          if(window.map) window.map.easeTo({ center: [${partyLng}, ${partyLat}], zoom: 15, duration: 700 });
          if(window.triggerPartySpawn) window.triggerPartySpawn(${partyLat}, ${partyLng});
        })();true;`
      );
    }

    setPartyName("");
    setPartyAddress("");
    setSelectedPartyMemberIds([]);
    setCreateComposerMode(null);
    setShowPartyComposer(false);
  }, [effectivePresenceMode, homeLocation, partyName, partyAddress, selectedPartyMembers, createParty,
      currentUser, allParties, visibleUsers, livePois, filterMode, presenceMode]);

  const handleCreateGroup = useCallback(() => {
    if (effectivePresenceMode === "home") {
      Alert.alert(
        "Daheim-Modus",
        "Du bist gerade passiv unterwegs. Wechsle zu Online, um eine Gruppe zu starten.",
      );
      return;
    }
    if (selectedGroupMembers.length === 0) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const groupId = createGroup(groupName.trim() || `Gruppe ${groups.length + 1}`, selectedGroupMembers);
    setGroupName("");
    setSelectedGroupMemberIds([]);
    setGroupDropdownId(groupId);
    setGroupManageSubview(null);
  }, [createGroup, effectivePresenceMode, groupName, groups.length, selectedGroupMembers]);

  const handleSaveGroupMembers = useCallback((groupId: string) => {
    if (groupAddIds.length === 0) return;
    const nextMembers = groupPickerUsers
      .filter((friend) => groupAddIds.includes(friend.id))
      .map((friend) => ({
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar,
        activity: friend.activity,
      }));
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    const existingIds = new Set(group.members.map((member) => member.id));
    updateGroupMembers(groupId, [
      ...group.members,
      ...nextMembers.filter((member) => !existingIds.has(member.id)),
    ]);
    setGroupAddIds([]);
    setGroupManageSubview(null);
  }, [groupAddIds, groupPickerUsers, groups, updateGroupMembers]);

  const handleRemoveGroupMember = useCallback((groupId: string, memberId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    updateGroupMembers(groupId, group.members.filter((member) => member.id !== memberId));
  }, [groups, updateGroupMembers]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    deleteGroup(groupId);
    setGroupDropdownId((openId) => openId === groupId ? null : openId);
    setGroupManageSubview(null);
    setGroupAddIds([]);
  }, [deleteGroup]);

  const handleSendUserMessage = useCallback(() => {
    if (!userPanelDraft.trim() || !selectedMapUser) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    addLocalMessage(selectedMapUser.id, {
      id: `map-msg-${Date.now()}`,
      senderId: "me",
      text: userPanelDraft.trim(),
      time,
    });
    setUserPanelDraft("");
    setSelectedMapUser(null);
  }, [selectedMapUser, userPanelDraft, addLocalMessage]);

  const handleDeleteParty = useCallback(() => {
    if (!myParty) return;
    Alert.alert("Party löschen", "Willst du die Party wirklich löschen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen", style: "destructive",
        onPress: () => {
          deleteParty(myParty.id);
          setPartyDropdownOpen(false);
          setPartyManageSubview(null);
          setShowPartyComposer(false);
        },
      },
    ]);
  }, [myParty, deleteParty]);

  const handleSaveAddMembers = useCallback(() => {
    if (!myParty) return;
    const newMembers = partyPickerUsers
      .filter((u) => partyAddIds.includes(u.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        lat: myParty.lat + (Math.random() - 0.5) * 0.0004,
        lng: myParty.lng + (Math.random() - 0.5) * 0.0004,
      }));
    const existingIds = new Set(myParty.members.map((m) => m.id));
    const merged = [...myParty.members, ...newMembers.filter((m) => !existingIds.has(m.id))];
    updatePartyMembers(myParty.id, merged);
    setPartyAddIds([]);
    setPartyManageSubview(null);
  }, [myParty, partyPickerUsers, partyAddIds, updatePartyMembers]);

  const handleRemoveMember = useCallback((memberId: string) => {
    if (!myParty) return;
    updatePartyMembers(myParty.id, myParty.members.filter((m) => m.id !== memberId));
  }, [myParty, updatePartyMembers]);

  const handleSendFriendRequest = useCallback(() => {
    if (!selectedMapUser) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Anfrage gesendet ✓", `Du hast ${selectedMapUser.name} eine Freundschaftsanfrage geschickt.`);
    setSelectedMapUser(null);
  }, [selectedMapUser]);

  const handleUserPickImage = useCallback(async () => {
    setUserMediaModalOpen(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.85, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Foto gesendet ✓", `Das Foto wurde an ${selectedMapUser?.name} gesendet.`);
      setSelectedMapUser(null);
    }
  }, [selectedMapUser]);

  const handleUserTakePhoto = useCallback(async () => {
    setUserMediaModalOpen(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Foto gesendet ✓", `Das Foto wurde an ${selectedMapUser?.name} gesendet.`);
      setSelectedMapUser(null);
    }
  }, [selectedMapUser]);

  if (!homeLocation || !html) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 20 }]}>
        <Feather name="map-pin" size={40} color={Colors.light.textTertiary} />
        <Text style={styles.emptyTitle}>Kein Heimatort gesetzt</Text>
        <Text style={styles.emptyText}>
          Leg zuerst deinen Heimatort fest, um die Karte zu sehen.
        </Text>
      </View>
    );
  }

  const datingCount = mapUsers.filter((u) => u.intent !== "active").length;
  const friendsCount = mapUsers.filter((u) => u.isFriend).length;
  const selectedFilter =
    FILTER_OPTIONS.find((option) => option.mode === filterMode) ??
    FILTER_OPTIONS[0];
  const selectedPresence =
    PRESENCE_OPTIONS.find((option) => option.mode === presenceMode) ??
    PRESENCE_OPTIONS[0];
  const canCreateParty = partyName.trim().length > 0 && selectedPartyMembers.length > 0;
  const userPanelHeight = userPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });
  const userPanelWidth = userPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 286] });
  const userPanelOpacity = userPanelAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const partyPanelHeight = partyPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, 480],
  });
  const partyPanelWidth = partyPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 286],
  });
  const partyPanelOpacity = partyPanelAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Karte</Text>
        <View style={styles.headerRight}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{visibleUsers.length + radarUsers.length} aktiv</Text>
          </View>
          {/* Radar-Button */}
          <Pressable
            style={[styles.radarBtn, radarSettings.enabled && styles.radarBtnActive]}
            onPress={() => router.push("/radar-settings")}
            hitSlop={8}
          >
            <Feather
              name="radio"
              size={15}
              color={radarSettings.enabled ? Colors.light.onBright : Colors.light.text}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.presenceMenuWrap, { top: insets.top + 58 }]}>
        <Pressable
          style={[
            styles.presenceButton,
            presenceMenuOpen && styles.presenceButtonActive,
          ]}
          onPress={() => {
            setPresenceMenuOpen((open) => !open);
            setFilterMenuOpen(false);
          }}
        >
          <Feather
            name="user"
            size={17}
            color={presenceMenuOpen ? selectedPresence.color : Colors.light.text}
          />
          <Text
            style={[
              styles.presenceButtonIcon,
              { color: selectedPresence.color },
            ]}
          >
            {selectedPresence.icon}
          </Text>
        </Pressable>
        {presenceMenuOpen && (
          <View style={styles.presenceDropdown}>
            {PRESENCE_OPTIONS.map((option) => {
              const selected = option.mode === presenceMode;
              return (
                <Pressable
                  key={option.mode}
                  style={[
                    styles.presenceOption,
                    selected && { backgroundColor: option.background },
                  ]}
                  onPress={() => {
                    setPresenceMode(option.mode);
                    setPresenceMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.presenceOptionIcon,
                      { color: option.color },
                    ]}
                  >
                    {option.icon}
                  </Text>
                  <Text
                    style={[
                      styles.filterText,
                      selected && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.filterMenuWrap, { top: insets.top + 58 }]}>
        <Pressable
          style={[
            styles.filterButton,
            filterMenuOpen && styles.filterButtonActive,
          ]}
          onPress={() => {
            setFilterMenuOpen((open) => !open);
            setPresenceMenuOpen(false);
          }}
        >
          <Feather
            name="filter"
            size={17}
            color={filterMenuOpen ? Colors.light.tint : Colors.light.tintBlue}
          />
          <Text
            style={[
              styles.filterButtonIcon,
              filterMenuOpen && styles.filterButtonIconActive,
            ]}
          >
            {selectedFilter.icon}
          </Text>
        </Pressable>
        {filterMenuOpen && (
          <View style={styles.filterDropdown}>
            {FILTER_OPTIONS.map((option) => {
              const selected = option.mode === filterMode;
              const count =
                option.mode === "dating"
                  ? datingCount
                  : option.mode === "friends"
                    ? friendsCount
                    : mapUsers.length;
              return (
                <Pressable
                  key={option.mode}
                  style={[
                    styles.filterOption,
                    selected && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setFilterMode(option.mode);
                    setFilterMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.filterIcon,
                      selected && styles.filterIconActive,
                    ]}
                  >
                    {option.icon}
                  </Text>
                  <Text
                    style={[
                      styles.filterText,
                      selected && styles.filterTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterCount,
                      selected && styles.filterCountActive,
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Map */}
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html }}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        startInLoadingState
        onMessage={handleMessage}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        )}
        onShouldStartLoadWithRequest={(req) =>
          req.url.startsWith("about:") ||
          req.url.startsWith("blob:") ||
          req.url.startsWith("https://") ||
          req.url.startsWith("http://")
        }
        onLoad={onMapLoad}
      />

      <Animated.View
        style={[
          styles.partyComposer,
          {
            bottom: insets.bottom + 100,
            height: partyPanelHeight,
            width: partyPanelWidth,
          },
        ]}
      >
        <Pressable
          style={[
            styles.partyComposerHeader,
            !showPartyComposer && styles.partyComposerHeaderClosed,
          ]}
          onPress={() => {
            if (effectivePresenceMode === "home") {
              Alert.alert(
                "Daheim-Modus",
                "Du bist gerade passiv unterwegs. Wechsle zu Online, um eine Party zu starten.",
              );
              return;
            }
            setShowPartyComposer((open) => {
              if (open) {
                setCreateComposerMode(null);
                setGroupDropdownId(null);
                setGroupManageSubview(null);
                setPartyDropdownOpen(false);
                setPartyManageSubview(null);
              }
              return !open;
            });
            setFilterMenuOpen(false);
            setPresenceMenuOpen(false);
          }}
        >
          <View style={styles.partyComposerTitleWrap}>
            <Feather name={showPartyComposer ? "x" : "plus"} size={showPartyComposer ? 20 : 24} color="#fff" />
            {showPartyComposer && <Text style={styles.fabLabel}>Erstellen</Text>}
          </View>
          {showPartyComposer && (
            <Feather name="chevron-down" size={18} color="#fff" />
          )}
        </Pressable>

        <Animated.View
          pointerEvents={showPartyComposer ? "auto" : "none"}
          style={[styles.partyComposerBody, { opacity: partyPanelOpacity }]}
        >
          <ScrollView
            style={styles.partyComposerScroll}
            contentContainerStyle={styles.partyComposerScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <Pressable
              style={[styles.createModeCard, createComposerMode === "group" && styles.createModeCardActive]}
              onPress={() => setCreateComposerMode((mode) => mode === "group" ? null : "group")}
            >
              <View style={styles.createModeIcon}>
                <Feather name="users" size={16} color={partyAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.createModeTitle}>Gruppe erstellen</Text>
                <Text style={styles.createModeSub} numberOfLines={1}>Freunde einladen und entfernen</Text>
              </View>
              <Feather name={createComposerMode === "group" ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textSecondary} />
            </Pressable>

            {createComposerMode === "group" && (
              <View style={styles.createDropdown}>
                {groups.length > 0 && (
                  <>
                    <Text style={styles.partyFieldLabel}>Deine Gruppen</Text>
                    {groups.map((group) => {
                      const isOpen = groupDropdownId === group.id;
                      const availableFriends = groupPickerUsers.filter(
                        (friend) => !group.members.some((member) => member.id === friend.id)
                      );
                      return (
                        <View key={group.id} style={styles.groupManageBlock}>
                          <GroupSwipeCard
                            group={group}
                            isOpen={isOpen}
                            onPress={() => {
                              setGroupDropdownId((openId) => openId === group.id ? null : group.id);
                              setGroupManageSubview(null);
                              setGroupAddIds([]);
                            }}
                            onDelete={() => handleDeleteGroup(group.id)}
                          />

                          {isOpen && groupManageSubview === null && (
                            <View style={styles.partyDropdown}>
                              <Pressable style={styles.partyDropdownItem} onPress={() => { setGroupManageSubview("add"); setGroupAddIds([]); }}>
                                <Feather name="user-plus" size={14} color={partyAccent} />
                                <Text style={styles.partyDropdownText}>Mitglied hinzufügen</Text>
                              </Pressable>
                              <View style={styles.partyDropdownDivider} />
                              <Pressable style={styles.partyDropdownItem} onPress={() => setGroupManageSubview("remove")}>
                                <Feather name="user-minus" size={14} color={Colors.light.textSecondary} />
                                <Text style={styles.partyDropdownText}>Mitglied entfernen</Text>
                              </Pressable>
                            </View>
                          )}

                          {isOpen && groupManageSubview === "add" && (
                            <View style={{ gap: 8 }}>
                              <Pressable style={styles.partyBackRow} onPress={() => setGroupManageSubview(null)}>
                                <Feather name="arrow-left" size={13} color={Colors.light.textSecondary} />
                                <Text style={styles.partyBackText}>Mitglied hinzufügen</Text>
                              </Pressable>
                              <TouchableOpacity
                                style={[styles.partyCreateButton, groupAddIds.length === 0 && styles.createBtnDisabled]}
                                onPress={() => handleSaveGroupMembers(group.id)}
                                disabled={groupAddIds.length === 0}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.partyCreateButtonText}>Hinzufügen</Text>
                              </TouchableOpacity>
                              <View style={styles.memberPicker}>
                                {availableFriends.length === 0 ? (
                                  <Text style={styles.selectedMembersEmpty}>Alle Freunde sind schon dabei</Text>
                                ) : (
                                  availableFriends.map((friend) => {
                                    const selected = groupAddIds.includes(friend.id);
                                    return (
                                      <Pressable
                                        key={friend.id}
                                        style={[styles.memberOption, selected && styles.memberOptionSelected]}
                                        onPress={() => setGroupAddIds((ids) => selected ? ids.filter((id) => id !== friend.id) : [...ids, friend.id])}
                                      >
                                        <Image source={{ uri: friend.avatar }} style={styles.memberOptionAvatar} />
                                        <View style={{ flex: 1 }}>
                                          <Text style={[styles.memberOptionName, selected && styles.memberOptionNameSelected]} numberOfLines={1}>
                                            {friend.name}
                                          </Text>
                                          <Text style={styles.memberOptionSub} numberOfLines={1}>{friend.activity}</Text>
                                        </View>
                                        <Feather name={selected ? "check" : "plus"} size={14} color={selected ? partyAccent : Colors.light.textTertiary} />
                                      </Pressable>
                                    );
                                  })
                                )}
                              </View>
                            </View>
                          )}

                          {isOpen && groupManageSubview === "remove" && (
                            <View style={{ gap: 8 }}>
                              <Pressable style={styles.partyBackRow} onPress={() => setGroupManageSubview(null)}>
                                <Feather name="arrow-left" size={13} color={Colors.light.textSecondary} />
                                <Text style={styles.partyBackText}>Mitglied entfernen</Text>
                              </Pressable>
                              <View style={styles.memberPicker}>
                                {group.members.length === 0 ? (
                                  <Text style={styles.selectedMembersEmpty}>Keine Mitglieder</Text>
                                ) : (
                                  group.members.map((member) => (
                                    <Pressable
                                      key={member.id}
                                      style={styles.selectedMemberRow}
                                      onPress={() => handleRemoveGroupMember(group.id, member.id)}
                                    >
                                      <Image source={{ uri: member.avatar }} style={styles.partyAvatar} />
                                      <Text style={styles.selectedMemberName}>{member.name}</Text>
                                      <Feather name="x" size={14} color="#EF4444" />
                                    </Pressable>
                                  ))
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                <Text style={styles.partyFieldLabel}>Neue Gruppe</Text>
                <TextInput
                  style={styles.partyNameInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="z.B. Freitagabend"
                  placeholderTextColor={Colors.light.textTertiary}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateGroup}
                />
                <TouchableOpacity
                  style={[styles.partyCreateButton, selectedGroupMembers.length === 0 && styles.createBtnDisabled]}
                  onPress={handleCreateGroup}
                  disabled={selectedGroupMembers.length === 0}
                  activeOpacity={0.85}
                >
                  <Text style={styles.partyCreateButtonText}>Neue Gruppe starten</Text>
                </TouchableOpacity>

                <Text style={styles.partyFieldLabel}>Eingeladen</Text>
                <View style={styles.selectedMembersBox}>
                  {selectedGroupMembers.length > 0 ? (
                    selectedGroupMembers.map((member) => (
                      <Pressable
                        key={member.id}
                        style={styles.selectedMemberRow}
                        onPress={() => toggleGroupMember(member.id)}
                      >
                        <Image source={{ uri: member.avatar }} style={styles.partyAvatar} />
                        <Text style={styles.selectedMemberName}>{member.name}</Text>
                        <Feather name="x" size={14} color={Colors.light.textTertiary} />
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.selectedMembersEmpty}>Noch niemand eingeladen</Text>
                  )}
                </View>

                <Text style={styles.partyFieldLabel}>Freunde hinzufügen</Text>
                <View style={styles.memberPicker}>
                  {groupPickerUsers.length === 0 ? (
                    <Text style={styles.selectedMembersEmpty}>Keine Freunde in der Nähe</Text>
                  ) : (
                    groupPickerUsers.map((friend) => {
                      const selected = selectedGroupMemberIds.includes(friend.id);
                      return (
                        <Pressable
                          key={friend.id}
                          style={[styles.memberOption, selected && styles.memberOptionSelected]}
                          onPress={() => toggleGroupMember(friend.id)}
                        >
                          <Image source={{ uri: friend.avatar }} style={styles.memberOptionAvatar} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.memberOptionName, selected && styles.memberOptionNameSelected]} numberOfLines={1}>
                              {friend.name}
                            </Text>
                            <Text style={styles.memberOptionSub} numberOfLines={1}>{friend.activity}</Text>
                          </View>
                          <Feather name={selected ? "check" : "plus"} size={14} color={selected ? partyAccent : Colors.light.textTertiary} />
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            <Pressable
              style={[styles.createModeCard, createComposerMode === "party" && styles.createModeCardActive]}
              onPress={() => setCreateComposerMode((mode) => mode === "party" ? null : "party")}
            >
              <View style={styles.createModeIcon}>
                <PartyPopperIcon size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.createModeTitle}>Party erstellen</Text>
                <Text style={styles.createModeSub} numberOfLines={1}>{myParty ? "Party verwalten" : "Name, Ort und Mitglieder"}</Text>
              </View>
              <Feather name={createComposerMode === "party" ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textSecondary} />
            </Pressable>

            {createComposerMode === "party" && (
              <View style={styles.createDropdown}>
                {myParty ? (
                  <>
              <PartySwipeCard
                party={myParty}
                isOpen={partyDropdownOpen}
                onPress={() => {
                  setPartyDropdownOpen((o) => !o);
                  setPartyManageSubview(null);
                }}
                onDelete={handleDeleteParty}
              />

              {/* Dropdown menu */}
              {partyDropdownOpen && partyManageSubview === null && (
                <View style={styles.partyDropdown}>
                  <Pressable style={styles.partyDropdownItem} onPress={() => { setPartyManageSubview("add"); setPartyAddIds([]); }}>
                    <Feather name="user-plus" size={14} color={partyAccent} />
                    <Text style={styles.partyDropdownText}>Mitglied hinzufügen</Text>
                  </Pressable>
                  <View style={styles.partyDropdownDivider} />
                  <Pressable style={styles.partyDropdownItem} onPress={() => setPartyManageSubview("remove")}>
                    <Feather name="user-minus" size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.partyDropdownText}>Mitglied entfernen</Text>
                  </Pressable>
                </View>
              )}

              {/* Sub-view: add members */}
              {partyManageSubview === "add" && (
                <View style={{ gap: 8 }}>
                  <Pressable style={styles.partyBackRow} onPress={() => setPartyManageSubview(null)}>
                    <Feather name="arrow-left" size={13} color={Colors.light.textSecondary} />
                    <Text style={styles.partyBackText}>Mitglied hinzufügen</Text>
                  </Pressable>
                  <TouchableOpacity
                    style={[styles.partyCreateButton, partyAddIds.length === 0 && styles.createBtnDisabled]}
                    onPress={handleSaveAddMembers}
                    disabled={partyAddIds.length === 0}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.partyCreateButtonText}>Hinzufügen</Text>
                  </TouchableOpacity>
                  <View style={styles.memberPicker}>
                    {partyPickerUsers
                      .filter((u) => !myParty.members.some((m) => m.id === u.id))
                      .map((user) => {
                        const sel = partyAddIds.includes(user.id);
                        return (
                          <Pressable
                            key={user.id}
                            style={[styles.memberOption, sel && styles.memberOptionSelected]}
                            onPress={() => setPartyAddIds((ids) => sel ? ids.filter((x) => x !== user.id) : [...ids, user.id])}
                          >
                            <Image source={{ uri: user.avatar }} style={styles.memberOptionAvatar} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.memberOptionName, sel && styles.memberOptionNameSelected]} numberOfLines={1}>
                                {user.name}{user.isFriend ? " ★" : ""}
                              </Text>
                              <Text style={styles.memberOptionSub} numberOfLines={1}>{user.activity}</Text>
                            </View>
                            <Feather name={sel ? "check" : "plus"} size={14} color={sel ? partyAccent : Colors.light.textTertiary} />
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              )}

              {/* Sub-view: remove members */}
              {partyManageSubview === "remove" && (
                <View style={{ gap: 8 }}>
                  <Pressable style={styles.partyBackRow} onPress={() => setPartyManageSubview(null)}>
                    <Feather name="arrow-left" size={13} color={Colors.light.textSecondary} />
                    <Text style={styles.partyBackText}>Mitglied entfernen</Text>
                  </Pressable>
                  <View style={styles.memberPicker}>
                    {myParty.members.length === 0 ? (
                      <Text style={styles.selectedMembersEmpty}>Keine Mitglieder</Text>
                    ) : (
                      myParty.members.map((m) => (
                        <Pressable
                          key={m.id}
                          style={styles.selectedMemberRow}
                          onPress={() => handleRemoveMember(m.id)}
                        >
                          <Text style={[styles.selectedMemberName, { flex: 1 }]}>{m.name}</Text>
                          <Feather name="x" size={14} color="#EF4444" />
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
              )}
                  </>
                ) : (
                  <>
              <TouchableOpacity
                style={[styles.partyCreateButton, !canCreateParty && styles.createBtnDisabled]}
                onPress={handleCreateParty}
                disabled={!canCreateParty}
                activeOpacity={0.85}
              >
                <Text style={styles.partyCreateButtonText}>Party starten</Text>
              </TouchableOpacity>
                <Text style={styles.partyFieldLabel}>Partyname</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.partyNameInput}
                  value={partyName}
                  onChangeText={setPartyName}
                  placeholder="z.B. Balkonrunde"
                  placeholderTextColor={Colors.light.textTertiary}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateParty}
                />

                <Text style={styles.partyFieldLabel}>Adresse / Ort</Text>
                <View style={styles.partyLocationRow}>
                  <TextInput
                    style={[styles.partyNameInput, { flex: 1 }]}
                    value={partyAddress}
                    onChangeText={setPartyAddress}
                    placeholder="Adresse eingeben…"
                    placeholderTextColor={Colors.light.textTertiary}
                    maxLength={80}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.currentLocationBtn}
                    onPress={() => setPartyAddress(currentLocationName ?? homeLocation.name)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.currentLocationBtnText}>📍</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.partyFieldLabel}>Mitglieder</Text>
                <View style={styles.selectedMembersBox}>
                  {selectedPartyMembers.length > 0 ? (
                    selectedPartyMembers.map((member) => (
                      <Pressable
                        key={member.id}
                        style={styles.selectedMemberRow}
                        onPress={() => togglePartyMember(member.id)}
                      >
                        <Image source={{ uri: member.avatar }} style={styles.partyAvatar} />
                        <Text style={styles.selectedMemberName}>{member.name}</Text>
                        <Feather name="x" size={14} color={Colors.light.textTertiary} />
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.selectedMembersEmpty}>Noch niemand dabei</Text>
                  )}
                </View>

                <Text style={styles.partyFieldLabel}>Mitglieder hinzufügen</Text>
                <View style={styles.memberPicker}>
                  {partyPickerUsers.length === 0 ? (
                    <Text style={styles.selectedMembersEmpty}>Niemand in der Nähe</Text>
                  ) : (
                    partyPickerUsers.map((user) => {
                      const selected = selectedPartyMemberIds.includes(user.id);
                      return (
                        <Pressable
                          key={user.id}
                          style={[styles.memberOption, selected && styles.memberOptionSelected]}
                          onPress={() => togglePartyMember(user.id)}
                        >
                          <Image source={{ uri: user.avatar }} style={styles.memberOptionAvatar} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.memberOptionName, selected && styles.memberOptionNameSelected]} numberOfLines={1}>
                              {user.name}{user.isFriend ? " ★" : ""}
                            </Text>
                            <Text style={styles.memberOptionSub} numberOfLines={1}>{user.activity}</Text>
                          </View>
                          <Feather name={selected ? "check" : "plus"} size={14} color={selected ? partyAccent : Colors.light.textTertiary} />
                        </Pressable>
                      );
                    })
                  )}
                </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* User Detail Panel – centred on map */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.userPanelOverlay]}
        onPress={() => setSelectedMapUser(null)}
        pointerEvents={selectedMapUser ? "auto" : "none"}
      >
        <Animated.View
          style={[styles.userDetailPanel, { height: userPanelHeight, width: userPanelWidth }]}
          onStartShouldSetResponder={() => true}
        >
        {selectedMapUser && (
          <>
            <View style={styles.userDetailHeader}>
              <Image
                source={{ uri: selectedMapUser.avatarUrl || `https://api.dicebear.com/9.x/thumbs/png?seed=${selectedMapUser.id}` }}
                style={styles.userDetailAvatar}
                contentFit="cover"
              />
              <View style={styles.userDetailHeaderText}>
                <Text style={styles.userDetailName} numberOfLines={1}>{selectedMapUser.name}</Text>
                <Text style={styles.userDetailSubtitle} numberOfLines={1}>
                  {selectedMapUser.isFriend ? "Freund" : "Unbekannt"}
                </Text>
              </View>
              <Pressable style={styles.userDetailCloseBtn} onPress={() => setSelectedMapUser(null)}>
                <Feather name="x" size={17} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <Animated.View style={[styles.userDetailBody, { opacity: userPanelOpacity }]} pointerEvents="auto">
              <ScrollView
                contentContainerStyle={styles.userDetailScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {selectedMapUser.isFriend ? (
                  <View style={styles.userActivityCard}>
                    <Text style={styles.userActivityCardLabel}>Was er/sie macht</Text>
                    <Text style={styles.userActivityCardText}>{selectedMapUser.activity}</Text>
                  </View>
                ) : (
                  <Pressable style={styles.friendRequestBtn} onPress={handleSendFriendRequest}>
                    <Feather name="user-plus" size={15} color="#fff" />
                    <Text style={styles.friendRequestBtnText}>Freundschaftsanfrage senden</Text>
                  </Pressable>
                )}

                <TextInput
                  ref={userPanelInputRef}
                  style={styles.userMessageInput}
                  value={userPanelDraft}
                  onChangeText={setUserPanelDraft}
                  placeholder="Nachricht schreiben..."
                  placeholderTextColor={Colors.light.textTertiary}
                  multiline
                  returnKeyType="default"
                  blurOnSubmit={false}
                />

                <View style={styles.userActionRow}>
                  {selectedMapUser.isFriend && (
                    <Pressable style={styles.userMediaBtn} onPress={() => setUserMediaModalOpen(true)}>
                      <Feather name="image" size={18} color={Colors.light.tintBlue} />
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.userSendBtn, !userPanelDraft.trim() && styles.userSendBtnDisabled]}
                    onPress={handleSendUserMessage}
                    disabled={!userPanelDraft.trim()}
                  >
                    <Feather name="send" size={14} color="#fff" />
                    <Text style={styles.userSendBtnText}>Senden</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Animated.View>
          </>
        )}
        </Animated.View>
      </Pressable>

      {/* User photo modal */}
      <Modal visible={userMediaModalOpen} transparent animationType="slide" onRequestClose={() => setUserMediaModalOpen(false)}>
        <Pressable style={styles.uMediaOverlay} onPress={() => setUserMediaModalOpen(false)}>
          <Pressable style={[styles.uMediaSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.uMediaHandle} />
            <Text style={styles.uMediaTitle}>Foto senden an {selectedMapUser?.name}</Text>
            <Pressable style={({ pressed }) => [styles.uMediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handleUserTakePhoto}>
              <View style={[styles.uMediaOptionIcon, { backgroundColor: Colors.light.tint }]}>
                <Feather name="camera" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.uMediaOptionLabel}>Foto aufnehmen</Text>
                <Text style={styles.uMediaOptionSub}>Kamera öffnen</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.uMediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handleUserPickImage}>
              <View style={[styles.uMediaOptionIcon, { backgroundColor: Colors.light.tintBlue }]}>
                <Feather name="image" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.uMediaOptionLabel}>Aus Galerie wählen</Text>
                <Text style={styles.uMediaOptionSub}>Foto aus der Bibliothek</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.uMediaCancelBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setUserMediaModalOpen(false)}>
              <Text style={styles.uMediaCancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const isNeonMapStyle = Colors.activeStyle.id === "neon";
const mapPanelBackground = isNeonMapStyle
  ? "rgba(7,19,31,0.86)"
  : Colors.light.backgroundSecondary;
const mapPanelActiveBackground = isNeonMapStyle
  ? "rgba(255,43,214,0.18)"
  : Colors.light.backgroundTertiary;
const mapPanelBorder = Colors.light.separator + "66";
const mapPanelShadow = isNeonMapStyle ? Colors.light.tintBlue : "#000";
const mapHeaderBackground = isNeonMapStyle ? "rgba(2,7,13,0.76)" : Colors.light.backgroundSecondary;
const activeBadgeBackground = isNeonMapStyle ? "rgba(0,255,178,0.13)" : Colors.light.backgroundTertiary;
const activeBadgeColor = Colors.light.mint;
const countBadgeBackground = isNeonMapStyle ? "rgba(0,240,255,0.12)" : Colors.light.backgroundTertiary;
const countBadgeActiveBackground = isNeonMapStyle ? "rgba(255,43,214,0.2)" : Colors.light.backgroundTertiary;
const countBadgeActiveColor = Colors.light.tint;
const partyAccent = Colors.light.tint;
const partyAccentSoft = isNeonMapStyle ? "rgba(255,43,214,0.12)" : Colors.light.backgroundTertiary;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: mapHeaderBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mapPanelBorder,
  },
  headerTitle: {
    fontSize: 20, fontWeight: "700",
    color: Colors.light.text,
  },
  headerRight: { flexDirection: "row", gap: 8 },

  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: activeBadgeBackground,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isNeonMapStyle ? Colors.light.mint : mapPanelBorder,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.mint },
  badgeText: { fontSize: 12, fontWeight: "600", color: activeBadgeColor },

  map: { flex: 1 },

  radarBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator,
  },
  radarBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  radarOverlayWrap: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },

  presenceMenuWrap: {
    position: "absolute",
    left: 12,
    zIndex: 11,
    alignItems: "flex-start",
  },
  presenceButton: {
    width: 76,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapPanelBorder,
    backgroundColor: mapPanelBackground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  presenceButtonActive: {
    borderColor: Colors.light.tint,
    backgroundColor: mapPanelActiveBackground,
  },
  presenceButtonIcon: {
    width: 22,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  presenceDropdown: {
    width: 190,
    marginTop: 8,
    borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapPanelBorder,
    backgroundColor: mapPanelBackground,
    padding: 6,
    gap: 4,
    shadowColor: mapPanelShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  presenceOption: {
    minHeight: 38,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
  },
  presenceOptionIcon: {
    width: 18,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  filterMenuWrap: {
    position: "absolute",
    right: 12,
    zIndex: 11,
    alignItems: "flex-end",
  },
  filterButton: {
    width: 76,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapPanelBorder,
    backgroundColor: mapPanelBackground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  filterButtonActive: {
    borderColor: Colors.light.tint,
    backgroundColor: mapPanelActiveBackground,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.text,
  },
  filterButtonIcon: {
    width: 22,
    fontSize: 17,
    fontWeight: "900",
    color: Colors.light.tintBlue,
    textAlign: "center",
  },
  filterButtonIconActive: {
    color: Colors.light.tint,
  },
  filterDropdown: {
    width: 190,
    marginTop: 8,
    borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapPanelBorder,
    backgroundColor: mapPanelBackground,
    padding: 6,
    gap: 4,
    shadowColor: mapPanelShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  filterOption: {
    minHeight: 38,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
  },
  filterOptionActive: {
    backgroundColor: isNeonMapStyle ? "rgba(0,240,255,0.13)" : Colors.light.backgroundTertiary,
  },
  filterIcon: {
    width: 18,
    fontSize: 15,
    color: Colors.light.tintBlue,
    fontWeight: "900",
    textAlign: "center",
  },
  filterIconActive: {
    color: Colors.light.tint,
  },
  filterText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  filterTextActive: {
    color: isNeonMapStyle ? Colors.light.tintBlue : Colors.light.mint,
  },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: countBadgeBackground,
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  filterCountActive: {
    backgroundColor: countBadgeActiveBackground,
    color: countBadgeActiveColor,
  },

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.background,
  },

  partyComposer: {
    position: "absolute",
    left: 16,
    borderRadius: Colors.shape.radiusLg,
    backgroundColor: mapPanelBackground,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapPanelBorder,
    shadowColor: mapPanelShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 12,
  },
  partyComposerHeader: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: partyAccent,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mapPanelBorder,
  },
  partyComposerHeaderClosed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  partyComposerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fabLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  partyComposerBody: {
    flex: 1,
  },
  partyComposerScroll: {
    flex: 1,
  },
  partyComposerScrollContent: {
    padding: 12,
    gap: 8,
    paddingBottom: 14,
  },
  createModeCard: {
    minHeight: 58,
    borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  createModeCardActive: {
    borderColor: partyAccent,
    backgroundColor: partyAccentSoft,
  },
  createModeIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: partyAccent + "66",
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  createModeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.light.text,
  },
  createModeSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  createDropdown: {
    gap: 8,
    paddingBottom: 4,
  },
  groupManageBlock: {
    gap: 8,
  },
  groupSwipeRow: {
    position: "relative",
    overflow: "hidden",
    borderRadius: Colors.shape.radiusMd,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  groupDeleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  groupSwipeFront: {
    width: "100%",
    backgroundColor: mapPanelBackground,
  },
  groupCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: partyAccent + "66",
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  partyFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
  },
  partyNameInput: {
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  selectedMembersBox: {
    minHeight: 42,
    gap: 6,
  },
  selectedMemberRow: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
  },
  partyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  selectedMemberName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.text,
  },
  selectedMembersEmpty: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    color: Colors.light.textTertiary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 38,
    paddingHorizontal: 10,
  },
  memberPicker: {
    gap: 6,
  },
  memberOption: {
    minHeight: 32,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    backgroundColor: Colors.light.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  memberOptionSelected: {
    borderColor: partyAccent,
    backgroundColor: partyAccentSoft,
  },
  memberOptionAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  memberOptionName: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  memberOptionSub: {
    fontSize: 10,
    color: Colors.light.textTertiary,
    fontWeight: "500",
  },
  partyLocationRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  currentLocationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocationBtnText: {
    fontSize: 18,
  },
  memberOptionNameSelected: {
    color: partyAccent,
  },
  myPartyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: partyAccentSoft,
    borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: partyAccent + "55",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myPartyCardEmoji: {
    fontSize: 20,
  },
  myPartyCardName: {
    fontSize: 13,
    fontWeight: "800",
    color: partyAccent,
  },
  myPartyCardSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  partyDropdown: {
    borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    backgroundColor: Colors.light.background,
    overflow: "hidden",
  },
  partyDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  partyDropdownText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
  partyDropdownDivider: {
    height: 1,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 14,
  },
  partyBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  partyBackText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  partyCreateButton: {
    height: 38,
    borderRadius: 19,
    backgroundColor: partyAccent,
    borderWidth: 0,
    borderColor: mapPanelBorder,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  partyCreateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.separator,
    alignSelf: "center", marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 20, fontWeight: "700",
    color: Colors.light.text, letterSpacing: -0.5,
  },
  sheetSubtitle: {
    fontSize: 14, color: Colors.light.textSecondary, lineHeight: 19,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.light.separator,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 16, color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  createBtn: {
    backgroundColor: partyAccent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 15, color: Colors.light.textSecondary, fontWeight: "500" },

  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.text, textAlign: "center" },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },

  // ── User Detail Panel ────────────────────────────────────────────────────────
  userPanelOverlay: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  userDetailPanel: {
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: mapPanelBackground,
    overflow: "hidden",
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: mapPanelBorder,
    shadowColor: mapPanelShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 12,
  },
  userDetailHeader: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: isNeonMapStyle ? "rgba(0,240,255,0.10)" : Colors.light.backgroundSecondary,
    borderBottomWidth: Colors.shape.borderWidthThin,
    borderBottomColor: mapPanelBorder,
  },
  userDetailAvatar: {
    width: 38, height: 38,
    borderRadius: isNeonMapStyle ? Colors.shape.radiusSm : 19,
    borderWidth: 1,
    borderColor: Colors.light.tintBlue,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  userDetailHeaderText: { flex: 1, minWidth: 0 },
  userDetailName: { fontSize: 14, fontWeight: "800", color: Colors.light.text },
  userDetailSubtitle: { fontSize: 11, fontWeight: "600", color: Colors.light.tintBlue, marginTop: 2 },
  userDetailCloseBtn: {
    width: 30, height: 30,
    alignItems: "center", justifyContent: "center",
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  userDetailBody: { flex: 1 },
  userDetailScroll: { padding: 12, gap: 10 },
  userActivityCard: {
    padding: 10,
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: isNeonMapStyle ? "rgba(0,240,255,0.07)" : Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: isNeonMapStyle ? Colors.light.tintBlue : Colors.light.separator,
  },
  userActivityCardLabel: {
    fontSize: 10, fontWeight: "700",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  userActivityCardText: { fontSize: 13, fontWeight: "600", color: Colors.light.tintBlue },
  friendRequestBtn: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: Colors.light.tint,
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: mapPanelBorder,
  },
  friendRequestBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  userMessageInput: {
    minHeight: 72, maxHeight: 110,
    borderRadius: Colors.shape.radiusSm,
    borderWidth: 1,
    borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: Colors.light.text,
  },
  userActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  userMediaBtn: {
    width: 42, height: 42,
    alignItems: "center", justifyContent: "center",
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: Colors.light.separator,
  },
  userSendBtn: {
    flex: 1, height: 42,
    flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 6,
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: Colors.light.tint,
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: mapPanelBorder,
  },
  userSendBtnDisabled: { opacity: 0.38 },
  userSendBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // ── User photo modal ──────────────────────────────────────────────────────────
  uMediaOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  uMediaSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 12,
    borderTopWidth: 3, borderTopColor: Colors.light.text,
  },
  uMediaHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.separator, alignSelf: "center", marginBottom: 8 },
  uMediaTitle: { fontSize: 17, fontWeight: "700", color: Colors.light.text, marginBottom: 4 },
  uMediaOption: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: Colors.shape.radiusSm,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: Colors.shape.borderWidthThin, borderColor: Colors.light.text,
  },
  uMediaOptionIcon: { width: 48, height: 48, borderRadius: Colors.shape.radiusSm, alignItems: "center", justifyContent: "center" },
  uMediaOptionLabel: { fontSize: 15, fontWeight: "700", color: Colors.light.text },
  uMediaOptionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  uMediaCancelBtn: { alignItems: "center", paddingVertical: 14 },
  uMediaCancelText: { fontSize: 15, color: Colors.light.textSecondary, fontWeight: "500" },
});
