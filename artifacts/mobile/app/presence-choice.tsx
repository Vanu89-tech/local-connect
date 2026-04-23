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
    <View style={[styles.container, { paddingTop: insets.top + 36 }]}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Wie möchtest du starten?</Text>
        <Text style={styles.title}>Locals</Text>
        <Text style={styles.subtitle}>
          Online macht dich aktiv sichtbar. Daheim lässt dich lesen und schauen,
          ohne selbst aktiv aufzutauchen.
        </Text>
      </View>

      <View style={styles.choices}>
        <Pressable
          style={({ pressed }) => [
            styles.choice,
            styles.onlineChoice,
            { opacity: pressed ? 0.86 : 1 },
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
              <View style={styles.dot}>
                <Feather name="radio" size={34} color="#FFFFFF" />
              </View>
              <Text style={styles.choiceTitle}>Online</Text>
              <Text style={styles.choiceText}>
                Du kannst posten, liken, Parties starten und auf der Karte aktiv sein.
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.choice,
            styles.homeChoice,
            { opacity: pressed ? 0.86 : 1 },
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
              <View style={[styles.dot, styles.homeDot]}>
                <Feather name="home" size={34} color={Colors.light.primary} />
              </View>
              <Text style={[styles.choiceTitle, styles.homeTitle]}>Daheim</Text>
              <Text style={[styles.choiceText, styles.homeText]}>
                Du siehst Posts und Karte, bleibst aber passiv und erscheinst offline.
              </Text>
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
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 36,
  },
  copy: {
    gap: 10,
  },
  kicker: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
  title: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  choices: {
    gap: 16,
  },
  choice: {
    minHeight: 178,
    borderRadius: 8,
    padding: 22,
    justifyContent: "center",
    gap: 12,
  },
  onlineChoice: {
    backgroundColor: Colors.light.primary,
  },
  homeChoice: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.separator,
  },
  dot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  homeDot: {
    backgroundColor: Colors.light.background,
  },
  choiceTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  homeTitle: {
    color: Colors.light.primary,
  },
  choiceText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 20,
  },
  homeText: {
    color: Colors.light.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
