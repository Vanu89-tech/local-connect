import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { Party, PartyMember, useApp } from "@/context/AppContext";
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

function areMapPartiesEqual(a: MapParty[], b: MapParty[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.hostName !== y.hostName ||
      Math.abs(x.lat - y.lat) > 0.000001 ||
      Math.abs(x.lng - y.lng) > 0.000001 ||
      x.members.length !== y.members.length
    ) {
      return false;
    }
    for (let j = 0; j < x.members.length; j += 1) {
      const xm = x.members[j];
      const ym = y.members[j];
      if (
        xm.id !== ym.id ||
        xm.name !== ym.name ||
        Math.abs(xm.lat - ym.lat) > 0.000001 ||
        Math.abs(xm.lng - ym.lng) > 0.000001
      ) {
        return false;
      }
    }
  }
  return true;
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

function buildMapHtml(
  lat: number,
  lng: number,
  activeUsers: MapUser[],
  livePois: LivePoi[],
  parties: MapParty[],
  locationName: string,
  filterMode: MapFilterMode,
  presenceMode: MapPresenceMode,
  showDevMapTools: boolean
) {
  const usersJson = JSON.stringify(activeUsers);
  const livePoisJson = JSON.stringify(livePois);
  const partiesJson = JSON.stringify(parties);
  const filterModeJson = JSON.stringify(filterMode);
  const presenceModeJson = JSON.stringify(presenceMode);
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
        linear-gradient(rgba(0, 240, 255, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 240, 255, 0.07) 1px, transparent 1px),
        radial-gradient(circle at 12% 16%, ${mapStyle.overlayBlue} 0%, rgba(0, 240, 255, 0) 32%),
        radial-gradient(circle at 84% 80%, ${mapStyle.overlayPink} 0%, rgba(255, 43, 214, 0) 36%),
        radial-gradient(circle at 52% 42%, ${mapStyle.overlayYellow} 0%, rgba(239, 255, 58, 0) 38%);
      background-size: 34px 34px, 34px 34px, auto, auto, auto;
      mix-blend-mode: screen;
    }
    #vignette {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 360;
      box-shadow:
        inset 0 0 90px rgba(0, 240, 255, 0.16),
        inset 0 0 180px rgba(0, 0, 0, 0.62);
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
      filter: saturate(1.75) contrast(1.2) hue-rotate(-9deg) brightness(0.82);
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
      0%   { transform: scale(1);   opacity: 1; }
      50%  { transform: scale(1.35); opacity: 0.65; }
      100% { transform: scale(1);   opacity: 1; }
    }
    .party-pulse { animation: partyPulse 2.4s infinite; }
    @keyframes partyPulse {
      0%   { box-shadow: 0 0 0 0 ${PARTY_COLORS.shadow}; }
      60%  { box-shadow: 0 0 0 13px rgba(255,43,214,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,43,214,0); }
    }
    .popup { font-size: 13px; min-width: 130px; }
    .popup a  { display: block; color: var(--ink); font-weight: 800; cursor: pointer; text-decoration: none; }
    .popup a:active { color: var(--accent); }
    .popup strong { display: block; color: var(--ink); font-weight: 900; font-size: 14px; }
    .popup span { color: var(--accent-blue); font-size: 11px; margin-top: 2px; display: block; font-weight: 700; }
    .friend-name-tag {
      padding: 2px 8px;
      border-radius: var(--marker-radius);
      border: 1px solid var(--accent-blue);
      background: rgba(7, 19, 31, 0.92);
      box-shadow: 0 0 12px rgba(0,240,255,0.32);
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

    var initialZoom = 15;
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

    var map = new maplibregl.Map({
      container: 'map',
      style: baseStyle,
      center: [${lng}, ${lat}],
      zoom: initialZoom,
      pitch: 0,
      maxPitch: 60,
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
    }

    function pushMarker(marker) {
      markerRefs.push(marker);
      return marker;
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

    // ── Event delegation ──────────────────────────────────────────────────────
    document.addEventListener('click', function(e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.getAttribute && t.getAttribute('data-user-id')) {
          e.preventDefault(); e.stopPropagation();
          postNativeMessage({ type: 'profile', id: t.getAttribute('data-user-id') });
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
      var heading = userId
        ? '<a data-user-id="' + userId + '" class="info-sheet-title">' + title + '</a>'
        : '<div class="info-sheet-title">' + title + '</div>';
      var visual = avatarSrc
        ? '<img class="info-sheet-avatar" src="' + avatarSrc + '" alt="" />'
        : '<div class="info-sheet-icon">' + (iconHtml || 'ℹ️') + '</div>';
      return [
        '<div class="info-sheet">',
        visual,
        '<div>',
        heading,
        '<div class="info-sheet-activity">' + subtitle + '</div>',
        '</div>',
        '</div>'
      ].join('');
    }

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

    function addLivePoiMarkers() {
      var pois = ${livePoisJson};
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

      pois.forEach(function(poi) {
        if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') return;
        var base = styles[poi.category] || styles.shop;
        var category = resolvePoiVisual(poi, base);
        var poiEl = markerEl(
          28,
          category.bg,
          category.border,
          category.shadow,
          '<span style="font-size:15px; line-height:1;">' + category.icon + '</span>'
        );
        poiEl.style.cursor = 'pointer';

        pushMarker(new maplibregl.Marker({ element: poiEl, anchor: 'center' })
          .setLngLat([poi.lng, poi.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setHTML(
            infoSheetHtml(poi.name || 'POI', category.subtitle, category.icon)
          ))
          .addTo(map));
      });
    }

    function addPartyAndMemberMarkers() {
      var partyData = ${partiesJson};
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
      var users = ${usersJson};
      var currentFilter = ${filterModeJson};

      users.forEach(function(u) {
        var showDatingMarker = currentFilter === 'dating' && u.intent !== 'active';
        var showFriendMarker = currentFilter === 'friends';
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
        } else if (showFriendMarker) {
          var bubble = markerEl(
            28,
            'linear-gradient(135deg,rgba(0,255,178,0.2) 0%,rgba(0,240,255,0.18) 100%)',
            '1px solid var(--mint)',
            '0 0 14px rgba(0,255,178,0.38)',
            '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="#00ffb2"/><circle cx="16" cy="8" r="3.2" fill="#00f0ff"/><path fill="#00ffb2" d="M2.8 19.4c.6-3.6 2.8-5.7 5.2-5.7s4.6 2.1 5.2 5.7c.1.5-.3.9-.8.9H3.6c-.5 0-.9-.4-.8-.9z"/><path fill="#00f0ff" d="M10.8 19.4c.6-3.6 2.8-5.7 5.2-5.7s4.6 2.1 5.2 5.7c.1.5-.3.9-.8.9h-8.8c-.5 0-.9-.4-.8-.9z"/></svg>'
          );
          var wrap = document.createElement('div');
          wrap.className = 'friend-marker-wrap pulse';
          var label = document.createElement('div');
          label.className = 'friend-name-tag';
          label.textContent = u.name || 'Freund';
          wrap.appendChild(label);
          wrap.appendChild(bubble);
          el = wrap;
        } else {
          el = markerEl(
            15,
            'linear-gradient(135deg, var(--mint) 0%, var(--accent-blue) 100%)',
            '1px solid rgba(234,251,255,0.9)',
            '0 0 12px rgba(0,255,178,0.42)'
          );
        }
        if (!showFriendMarker) {
          el.className = 'pulse';
        }

        var subtitle = showDatingMarker
          ? (u.intent === 'relationship' ? 'Sucht eine Beziehung' : 'Sucht Freunde')
          : currentFilter === 'friends'
            ? 'Freund'
            : 'Gerade aktiv ↗';

        var activityText = u.intent === 'relationship'
          ? 'Gerade auf Beziehungssuche'
          : u.intent === 'friend'
            ? 'Gerade auf Freundesuche'
            : 'Gerade online unterwegs';

        var avatarSrc = u.avatarUrl
          ? u.avatarUrl
          : 'https://api.dicebear.com/9.x/thumbs/png?seed=' + encodeURIComponent(u.id || u.name || 'local');
        var friendPopupHtml = infoSheetHtml(
          u.name || 'Freund',
          activityText,
          '🧑',
          u.id,
          avatarSrc
        );

        pushMarker(new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([u.lng, u.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setHTML(
            currentFilter === 'friends'
              ? friendPopupHtml
              : infoSheetHtml(u.name || 'Local', subtitle, '🧑', u.id, avatarSrc)
          ))
          .addTo(map));
      });
    }

    function addMyMarker() {
      var myPresence = ${presenceModeJson};
      var mePopupText = 'Gerade online';
      var meEl = null;

      if (myPresence === 'friend' || myPresence === 'relationship') {
        var meHeartColor = myPresence === 'relationship' ? '#ff3864' : '#00ffb2';
        var meHeartBackground = myPresence === 'relationship' ? 'rgba(255,56,100,0.22)' : 'rgba(0,255,178,0.18)';
        mePopupText = myPresence === 'relationship' ? 'Sucht eine Beziehung' : 'Sucht Freunde';
        meEl = markerEl(
          30,
          'linear-gradient(135deg,rgba(7,19,31,0.96) 0%,' + meHeartBackground + ' 100%)',
          '1px solid ' + meHeartColor,
          '0 0 16px ' + meHeartBackground,
          '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="' + meHeartColor + '" d="M12 21s-7.2-4.6-9.6-9.2C.7 8.5 2.6 4.5 6.3 4.2c2-.2 3.5.8 4.4 2.1.3.4.9.4 1.2 0 1-1.4 2.5-2.3 4.4-2.1 3.7.3 5.6 4.3 3.9 7.6C19.2 16.4 12 21 12 21z"/></svg>'
        );
      } else {
        meEl = markerEl(
          19,
          'linear-gradient(135deg, #ff3864 0%, #ff2bd6 100%)',
          '1px solid var(--ink)',
          '0 0 16px rgba(255,56,100,0.48)'
        );
      }

      meEl.className = 'pulse';

      var meMarker = pushMarker(new maplibregl.Marker({ element: meEl, anchor: 'center' })
        .setLngLat([${lng}, ${lat}])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 11 }).setHTML(
          infoSheetHtml('Du', mePopupText, '📍')
        ))
        .addTo(map));

      meMarker.togglePopup();
    }

    function renderMapLayersAndMarkers() {
      clearMarkers();
      var currentFilter = ${filterModeJson};
      var peopleOnly = currentFilter === 'people';

      addStyledBuildings();
      add3DBuildings();
      if (!peopleOnly) addLivePoiMarkers();
      addPartyAndMemberMarkers();
      addUserMarkers();
      addMyMarker();
    }

    map.on('style.load', function() {
      renderMapLayersAndMarkers();
    });

    map.on('error', function(errorEvent) {
      var msg = errorEvent && errorEvent.error && errorEvent.error.message
        ? errorEvent.error.message
        : 'Unbekannter MapLibre-Fehler';
      postNativeMessage({ type: 'map_error', message: msg });
    });

  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { user } = useAuth();
  const { homeLocation, currentLocationName, effectivePresenceMode } = useLocation();
  const { posts, parties: storedParties, createParty, currentUser } = useApp();
  const { nearbyUsers: radarUsers, radarSettings, myLiveLocation } = useProximity();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebViewType>(null);

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

  const [showPartyComposer, setShowPartyComposer] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [selectedPartyMemberIds, setSelectedPartyMemberIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<MapFilterMode>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [presenceMode, setPresenceMode] = useState<MapPresenceMode>("online");
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<MapUser[]>([]);
  const [livePois, setLivePois] = useState<LivePoi[]>([]);
  const [renderedUsers, setRenderedUsers] = useState<MapUser[]>([]);
  const [renderedPois, setRenderedPois] = useState<LivePoi[]>([]);
  const [renderedParties, setRenderedParties] = useState<MapParty[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [isMapActive, setIsMapActive] = useState(false);
  const partyPanelAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      setIsMapActive(true);
      return () => setIsMapActive(false);
    }, []),
  );

  useEffect(() => {
    Animated.spring(partyPanelAnim, {
      toValue: showPartyComposer ? 1 : 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [partyPanelAnim, showPartyComposer]);

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
      setLivePois((prev) => (areLivePoisEqual(prev, next) ? prev : next));
    } catch (error) {
      console.warn("live poi fetch exception", error);
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

    const userParties = storedParties.map((p) => {
      const hostIsCurrentUser = p.hostId === currentUser.id;
      const partyLat = hostIsCurrentUser ? homeLocation.lat : p.lat;
      const partyLng = hostIsCurrentUser ? homeLocation.lng : p.lng;
      const deltaLat = partyLat - p.lat;
      const deltaLng = partyLng - p.lng;

      return {
        id: p.id,
        name: p.name,
        lat: partyLat,
        lng: partyLng,
        hostName: p.hostName,
        members: p.members.map((member) => ({
          ...member,
          lat: member.lat + deltaLat,
          lng: member.lng + deltaLng,
        })),
      };
    });

    return [...mockParties, ...userParties];
  }, [homeLocation, allUsers, storedParties, currentUser.id]);

  const visibleUsers = useMemo(() => {
    if (filterMode === "friends") {
      return activeUsers.filter((u) => friendIds.has(u.id));
    }
    if (filterMode === "dating") {
      return activeUsers.filter((u) => u.intent !== "active");
    }
    return activeUsers;
  }, [activeUsers, filterMode, friendIds]);

  const visibleParties = useMemo(() => allParties, [allParties]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setRenderedUsers((prev) => (areMapUsersEqual(prev, visibleUsers) ? prev : visibleUsers));
      setRenderedPois((prev) => (areLivePoisEqual(prev, livePois) ? prev : livePois));
      setRenderedParties((prev) => (areMapPartiesEqual(prev, visibleParties) ? prev : visibleParties));
    }, 450);

    return () => clearTimeout(timeout);
  }, [livePois, visibleParties, visibleUsers]);

  const selectedPartyMembers = useMemo(
    () => allUsers.filter((user) => selectedPartyMemberIds.includes(user.id)),
    [allUsers, selectedPartyMemberIds]
  );

  const togglePartyMember = useCallback((id: string) => {
    setSelectedPartyMemberIds((current) =>
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
      renderedUsers,
      renderedPois,
      renderedParties,
      currentLocationName ?? homeLocation.name,
      filterMode,
      presenceMode,
      __DEV__
    );
  }, [homeLocation, renderedUsers, renderedPois, renderedParties, currentLocationName, filterMode, presenceMode]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "profile" && data.id) {
        router.push(`/user/${data.id}`);
        return;
      }
      if (data.type === "map_error") {
        console.warn("[MapWebView]", data.message ?? "Unbekannter Fehler");
      }
    } catch (_) {}
  }, []);

  const handleCreateParty = useCallback(() => {
    if (effectivePresenceMode === "home") {
      Alert.alert(
        "Daheim-Modus",
        "Du bist gerade passiv unterwegs. Wechsle zu Online, um eine Party zu starten.",
      );
      return;
    }
    if (!homeLocation || !partyName.trim() || selectedPartyMembers.length === 0) return;

    const partyLat = homeLocation.lat;
    const partyLng = homeLocation.lng;

    const members: PartyMember[] = selectedPartyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      lat: partyLat + (Math.random() - 0.5) * 0.0004,
      lng: partyLng + (Math.random() - 0.5) * 0.0004,
    }));

    createParty(partyName.trim(), partyLat, partyLng, members);
    setPartyName("");
    setSelectedPartyMemberIds([]);
    setShowPartyComposer(false);
  }, [effectivePresenceMode, homeLocation, partyName, selectedPartyMembers, createParty]);

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

  const datingCount = activeUsers.filter((u) => u.intent !== "active").length;
  const friendsCount = activeUsers.filter((u) => friendIds.has(u.id)).length;
  const selectedFilter =
    FILTER_OPTIONS.find((option) => option.mode === filterMode) ??
    FILTER_OPTIONS[0];
  const selectedPresence =
    PRESENCE_OPTIONS.find((option) => option.mode === presenceMode) ??
    PRESENCE_OPTIONS[0];
  const canCreateParty = partyName.trim().length > 0 && selectedPartyMembers.length > 0;
  const partyPanelHeight = partyPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, 360],
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
                    : activeUsers.length;
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
        onLoad={injectRadar}
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
            setShowPartyComposer((open) => !open);
            setFilterMenuOpen(false);
            setPresenceMenuOpen(false);
          }}
        >
          <View style={styles.partyComposerTitleWrap}>
            <PartyPopperIcon size={showPartyComposer ? 18 : 24} />
            {showPartyComposer && <Text style={styles.fabLabel}>Party</Text>}
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
              {allUsers.map((user) => {
                const selected = selectedPartyMemberIds.includes(user.id);
                return (
                  <Pressable
                    key={user.id}
                    style={[
                      styles.memberOption,
                      selected && styles.memberOptionSelected,
                    ]}
                    onPress={() => togglePartyMember(user.id)}
                  >
                    <Image source={{ uri: user.avatar }} style={styles.memberOptionAvatar} />
                    <Text
                      style={[
                        styles.memberOptionName,
                        selected && styles.memberOptionNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {user.name}
                    </Text>
                    <Feather
                      name={selected ? "check" : "plus"}
                      size={14}
                      color={selected ? "#7C3AED" : Colors.light.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.partyCreateButton,
                !canCreateParty && styles.createBtnDisabled,
              ]}
              onPress={handleCreateParty}
              disabled={!canCreateParty}
              activeOpacity={0.85}
            >
              <Text style={styles.partyCreateButtonText}>Party starten</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const isNeonMapStyle = Colors.activeStyle.id === "neon";
const mapPanelBackground = isNeonMapStyle
  ? "rgba(7,19,31,0.94)"
  : Colors.light.backgroundSecondary;
const mapPanelActiveBackground = isNeonMapStyle
  ? "rgba(255,43,214,0.18)"
  : Colors.light.backgroundTertiary;
const mapPanelBorder = Colors.light.separator;
const mapPanelShadow = isNeonMapStyle ? Colors.light.tintBlue : "#000";
const mapHeaderBackground = isNeonMapStyle ? "rgba(2,7,13,0.88)" : Colors.light.backgroundSecondary;
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
    borderBottomWidth: Colors.shape.borderWidthThin,
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
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: isNeonMapStyle ? Colors.light.mint : mapPanelBorder,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.mint },
  badgeText: { fontSize: 12, fontWeight: "600", color: activeBadgeColor },

  map: { flex: 1 },

  radarBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: Colors.shape.borderWidthThin,
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
    borderRadius: Colors.shape.radiusSm,
    borderWidth: Colors.shape.borderWidthThin,
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
    borderRadius: 8,
    borderWidth: Colors.shape.borderWidthThin,
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
    borderRadius: 8,
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
    borderRadius: Colors.shape.radiusSm,
    borderWidth: Colors.shape.borderWidthThin,
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
    borderRadius: Colors.shape.radiusSm,
    borderWidth: Colors.shape.borderWidthThin,
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
    borderRadius: 8,
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
  partyComposerHeader: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: partyAccent,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
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
  partyFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
  },
  partyNameInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.separator,
    borderRadius: 8,
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
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
  },
  partyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.separator,
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
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  memberOptionName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  memberOptionNameSelected: {
    color: partyAccent,
  },
  partyCreateButton: {
    height: 38,
    borderRadius: 8,
    backgroundColor: partyAccent,
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: mapPanelBorder,
    alignItems: "center",
    justifyContent: "center",
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
});
