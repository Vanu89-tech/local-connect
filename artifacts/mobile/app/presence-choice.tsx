import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useLocation, type AppPresenceMode } from "@/context/LocationContext";

export default function PresenceChoiceScreen() {
  const insets = useSafeAreaInsets();
  const {
    chooseStartMode,
    currentLocationName,
    homeLocation,
    locationMode,
  } = useLocation();
  const [loadingMode, setLoadingMode] = useState<AppPresenceMode | null>(null);

  const choose = async (mode: AppPresenceMode) => {
    setLoadingMode(mode);
    const finalMode = await chooseStartMode(mode);
    router.replace("/");
    setLoadingMode(null);

    if (finalMode === "home" && mode === "online") {
      // The next screen reflects passive mode; no extra UI needed here.
    }
  };

  const placeName = currentLocationName ?? homeLocation?.name ?? "Daheim";

  return (
    <View style={[styles.container, { paddingTop: insets.top + 30 }]}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Startmodus</Text>
        <Text style={styles.title}>Locals</Text>
        <Text style={styles.subtitle}>Wähle, wie du heute auf der Karte auftauchst.</Text>
      </View>

      <View style={styles.choices}>
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            styles.onlineButton,
            { opacity: pressed ? 0.88 : 1, transform: [{ translateY: pressed ? 3 : 0 }] },
          ]}
          disabled={!!loadingMode}
          onPress={() => {
            void choose("online");
          }}
        >
          {loadingMode === "online" ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <View style={styles.iconBadge}>
                <Feather name="radio" size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.modeTitle}>Online</Text>
              <Text style={styles.modeText}>Aktiv sichtbar</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            styles.homeButton,
            { opacity: pressed ? 0.88 : 1, transform: [{ translateY: pressed ? 3 : 0 }] },
          ]}
          disabled={!!loadingMode}
          onPress={() => {
            void choose("home");
          }}
        >
          {loadingMode === "home" ? (
            <ActivityIndicator color={Colors.light.primary} />
          ) : (
            <>
              <View style={[styles.iconBadge, styles.homeIconBadge]}>
                <Feather name="home" size={48} color={Colors.light.onBright} />
              </View>
              <Text style={[styles.modeTitle, styles.homeModeTitle]}>Daheim</Text>
              <Text style={[styles.modeText, styles.homeModeText]}>Passiv schauen</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Feather name="shield" size={15} color={Colors.light.textTertiary} />
        <Text style={styles.footerText}>
          Heimbereich: {placeName}. 500 Meter Perimeter
          {locationMode === "home" ? " aktiv." : "."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 22,
    justifyContent: "center",
    gap: 32,
  },
  copy: {
    alignItems: "center",
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: 0,
    textShadowColor: "transparent",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  subtitle: {
    maxWidth: 300,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 23,
    textAlign: "center",
    letterSpacing: 0,
  },
  choices: {
    alignItems: "center",
    gap: 16,
  },
  modeButton: {
    width: "100%",
    maxWidth: 330,
    height: 148,
    borderRadius: Colors.shape.radiusLg,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "88",
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: Colors.shadow.radius,
  },
  onlineButton: {
    backgroundColor: Colors.light.tint,
  },
  homeButton: {
    backgroundColor: Colors.light.yellow,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,34,56,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.38)",
  },
  homeIconBadge: {
    backgroundColor: "#FFFFFF",
  },
  modeTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0,
  },
  homeModeTitle: {
    color: Colors.light.onBright,
  },
  modeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  homeModeText: {
    color: Colors.light.onBright,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    maxWidth: 320,
    paddingBottom: Platform.OS === "ios" ? 8 : 0,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    lineHeight: 18,
  },
});
