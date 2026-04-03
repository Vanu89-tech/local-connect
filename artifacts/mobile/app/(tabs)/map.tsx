import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import Colors from "@/constants/colors";
import { Party, PartyMember, useApp } from "@/context/AppContext";
import { useLocation } from "@/context/LocationContext";

// ~200-700m offsets for general active users
const MOCK_USER_OFFSETS = [
  { dx: 0.003, dy: 0.002 },
  { dx: -0.005, dy: 0.001 },
  { dx: 0.002, dy: -0.004 },
  { dx: -0.002, dy: -0.003 },
  { dx: 0.007, dy: 0.003 },
  { dx: -0.001, dy: 0.006 },
  { dx: 0.004, dy: -0.007 },
  { dx: -0.006, dy: 0.004 },
];

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
  fill: "#8B5CF6",
  shadow: "rgba(139,92,246,0.55)",
  circle: "#8B5CF6",
};

function buildMapHtml(
  lat: number,
  lng: number,
  activeUsers: { lat: number; lng: number; name: string; id: string }[],
  parties: { id: string; name: string; lat: number; lng: number; hostName: string; members: { id: string; name: string; lat: number; lng: number }[] }[],
  locationName: string
) {
  const usersJson = JSON.stringify(activeUsers);
  const partiesJson = JSON.stringify(parties);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f0f0f0; }
    #map { width: 100vw; height: 100vh; }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse {
      0%   { transform: scale(1);   opacity: 1; }
      50%  { transform: scale(1.35); opacity: 0.65; }
      100% { transform: scale(1);   opacity: 1; }
    }
    .party-pulse { animation: partyPulse 2.4s infinite; }
    @keyframes partyPulse {
      0%   { box-shadow: 0 0 0 0 rgba(139,92,246,0.55); }
      60%  { box-shadow: 0 0 0 10px rgba(139,92,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
    }
    .popup { font-family: -apple-system, sans-serif; font-size: 13px; min-width: 130px; }
    .popup a  { display: block; color: #1A1A2E; font-weight: 600; cursor: pointer; text-decoration: none; }
    .popup a:active { color: #FF6B6B; }
    .popup strong { display: block; color: #1A1A2E; font-weight: 700; font-size: 14px; }
    .popup span { color: #6B7280; font-size: 11px; margin-top: 2px; display: block; }
    .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .leaflet-popup-tip-container { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
               .setView([${lat}, ${lng}], 15);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // ── Event delegation ──────────────────────────────────────────────────────
    document.addEventListener('click', function(e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.getAttribute && t.getAttribute('data-user-id')) {
          e.preventDefault(); e.stopPropagation();
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'profile', id: t.getAttribute('data-user-id') })
          );
          return;
        }
        t = t.parentNode;
      }
    }, true);

    // ── Parties ───────────────────────────────────────────────────────────────
    var parties = ${partiesJson};

    parties.forEach(function(party) {
      // Radius circle
      L.circle([party.lat, party.lng], {
        radius: 90,
        color: '${PARTY_COLORS.circle}',
        fillColor: '${PARTY_COLORS.fill}',
        fillOpacity: 0.10,
        weight: 1.5,
        dashArray: '6 4',
        interactive: false,
      }).addTo(map);

      // Member dots (inside the circle)
      party.members.forEach(function(m) {
        var mEl = document.createElement('div');
        mEl.style.cssText = 'width:11px;height:11px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);';
        L.marker([m.lat, m.lng], {
          icon: L.divIcon({ html: mEl, className: '', iconSize: [11, 11], iconAnchor: [5.5, 5.5] }),
          zIndexOffset: 300
        }).addTo(map).bindPopup(
          '<div class="popup"><a data-user-id="' + m.id + '">' + m.name + '</a><span>Party-Mitglied</span></div>',
          { closeButton: false, offset: [0, -6] }
        );
      });

      // Party marker (large purple dot)
      var pEl = document.createElement('div');
      pEl.style.cssText = [
        'width:26px', 'height:26px', 'border-radius:50%',
        'background:${PARTY_COLORS.fill}',
        'border:3px solid #fff',
        'box-shadow:0 2px 10px ${PARTY_COLORS.shadow}',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-size:13px', 'cursor:pointer'
      ].join(';');
      pEl.className = 'party-pulse';
      pEl.textContent = '🎉';

      L.marker([party.lat, party.lng], {
        icon: L.divIcon({ html: pEl, className: '', iconSize: [26, 26], iconAnchor: [13, 13] }),
        zIndexOffset: 600
      }).addTo(map)
        .bindPopup(
          '<div class="popup"><strong>' + party.name + '</strong>' +
          '<span>' + party.members.length + ' Mitglieder · von ' + party.hostName + '</span></div>',
          { closeButton: false, offset: [0, -14] }
        )
        .on('click', function() {
          map.flyTo([party.lat, party.lng], 18, { duration: 1.1, easeLinearity: 0.5 });
        });
    });

    // ── General active users ──────────────────────────────────────────────────
    var users = ${usersJson};
    users.forEach(function(u) {
      var el = document.createElement('div');
      el.style.cssText = 'width:13px;height:13px;border-radius:50%;background:#22c55e;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.22);';
      el.className = 'pulse';
      L.marker([u.lat, u.lng], {
        icon: L.divIcon({ html: el, className: '', iconSize: [13, 13], iconAnchor: [6.5, 6.5] })
      }).addTo(map).bindPopup(
        '<div class="popup"><a data-user-id="' + u.id + '">' + u.name + '</a><span>Gerade aktiv ↗</span></div>',
        { closeButton: false, offset: [0, -7] }
      );
    });

    // ── Current user ──────────────────────────────────────────────────────────
    var meEl = document.createElement('div');
    meEl.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#FF6B6B;border:3px solid #fff;box-shadow:0 2px 8px rgba(255,107,107,0.5);';
    L.marker([${lat}, ${lng}], {
      icon: L.divIcon({ html: meEl, className: '', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000
    }).addTo(map)
      .bindPopup('<div class="popup"><strong>Du</strong><span>${locationName}</span></div>',
        { closeButton: false, offset: [0, -10] })
      .openPopup();
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { homeLocation, currentLocationName } = useLocation();
  const { posts, parties: storedParties, createParty, currentUser } = useApp();
  const insets = useSafeAreaInsets();

  const [showModal, setShowModal] = useState(false);
  const [partyName, setPartyName] = useState("");
  const inputRef = useRef<TextInput>(null);

  const allUsers = useMemo(() => {
    const seen = new Set<string>();
    const users: { id: string; name: string }[] = [];
    posts.forEach((p) => {
      if (!seen.has(p.user.id)) {
        seen.add(p.user.id);
        users.push({ id: p.user.id, name: p.user.name });
      }
    });
    return users;
  }, [posts]);

  const activeUsers = useMemo(() => {
    if (!homeLocation) return [];
    return MOCK_USER_OFFSETS.map((offset, i) => {
      const u = allUsers[i % allUsers.length];
      return {
        lat: homeLocation.lat + offset.dx,
        lng: homeLocation.lng + offset.dy,
        name: u?.name ?? `Nutzer ${i + 1}`,
        id: u?.id ?? `u${i}`,
      };
    });
  }, [homeLocation, allUsers]);

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

  const html = useMemo(() => {
    if (!homeLocation) return null;
    return buildMapHtml(
      homeLocation.lat,
      homeLocation.lng,
      activeUsers,
      allParties,
      currentLocationName ?? homeLocation.name
    );
  }, [homeLocation, activeUsers, allParties, currentLocationName]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "profile" && data.id) {
        router.push(`/user/${data.id}`);
      }
    } catch (_) {}
  }, []);

  const handleCreateParty = useCallback(() => {
    if (!homeLocation || !partyName.trim()) return;

    // Place party slightly offset from exact home (so markers don't overlap)
    const jitter = () => (Math.random() - 0.5) * 0.0006;
    const partyLat = homeLocation.lat + jitter();
    const partyLng = homeLocation.lng + jitter();

    // Pick nearby users as members
    const members: PartyMember[] = activeUsers.slice(0, 4).map((u) => ({
      id: u.id,
      name: u.name,
      lat: partyLat + (Math.random() - 0.5) * 0.0004,
      lng: partyLng + (Math.random() - 0.5) * 0.0004,
    }));

    createParty(partyName.trim(), partyLat, partyLng, members);
    setPartyName("");
    setShowModal(false);
  }, [homeLocation, partyName, activeUsers, createParty]);

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

  const totalParties = allParties.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Karte</Text>
        <View style={styles.headerRight}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{activeUsers.length} aktiv</Text>
          </View>
          {totalParties > 0 && (
            <View style={[styles.badge, styles.partyBadge]}>
              <Text style={styles.partyBadgeText}>🎉 {totalParties}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Map */}
      <WebView
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
          req.url.includes("openstreetmap.org") ||
          req.url.includes("unpkg.com")
        }
      />

      {/* Party FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabEmoji}>🎉</Text>
        <Text style={styles.fabLabel}>Party</Text>
      </TouchableOpacity>

      {/* Legend */}
      <View style={[styles.legend, { bottom: insets.bottom + 100 }]}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
          <Text style={styles.legendText}>Aktiv</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: "#8B5CF6" }]} />
          <Text style={styles.legendText}>Party</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.light.tint }]} />
          <Text style={styles.legendText}>Du</Text>
        </View>
      </View>

      {/* Create Party Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable>
              <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>🎉 Party erstellen</Text>
                <Text style={styles.sheetSubtitle}>
                  Deine Party erscheint als lila Punkt auf der Karte.
                </Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={partyName}
                  onChangeText={setPartyName}
                  placeholder="Party-Name..."
                  placeholderTextColor={Colors.light.textTertiary}
                  maxLength={40}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateParty}
                />
                <TouchableOpacity
                  style={[
                    styles.createBtn,
                    !partyName.trim() && styles.createBtnDisabled,
                  ]}
                  onPress={handleCreateParty}
                  disabled={!partyName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.createBtnText}>Party starten</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

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
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  headerTitle: {
    fontSize: 20, fontWeight: "700",
    color: Colors.light.text, letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", gap: 8 },

  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },

  partyBadge: { backgroundColor: "#f5f3ff" },
  partyBadgeText: { fontSize: 12, fontWeight: "600", color: "#7C3AED" },

  map: { flex: 1 },

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.background,
  },

  fab: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  fabEmoji: { fontSize: 16 },
  fabLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },

  legend: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: "500" },

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
    backgroundColor: Colors.light.secondaryBackground,
  },
  createBtn: {
    backgroundColor: "#8B5CF6",
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
