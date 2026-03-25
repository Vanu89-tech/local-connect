import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const features = [
  {
    icon: "map-pin" as const,
    title: "Hyper-local",
    desc: "See what's happening in your neighborhood, not the whole world.",
  },
  {
    icon: "users" as const,
    title: "Real neighbors",
    desc: "Connect with people who share your streets, parks, and coffee shops.",
  },
  {
    icon: "heart" as const,
    title: "Community first",
    desc: "No algorithms, no ads. Just authentic local moments.",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad + 20 }]}>
      <View style={styles.heroSection}>
        <View style={styles.iconCluster}>
          <View style={[styles.bubble, styles.bubbleLeft]}>
            <Feather name="map-pin" size={22} color="#FFFFFF" />
          </View>
          <View style={[styles.bubble, styles.bubbleCenter]}>
            <Feather name="message-circle" size={28} color="#FFFFFF" />
          </View>
          <View style={[styles.bubble, styles.bubbleRight]}>
            <Feather name="users" size={20} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.appName}>Locals</Text>
        <Text style={styles.tagline}>Your neighborhood, connected.</Text>
      </View>

      <View style={styles.featuresSection}>
        {features.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Feather name={f.icon} size={18} color={Colors.light.tint} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.ctaSection, { paddingBottom: bottomPad + 20 }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}
          onPress={() => router.replace("/location-setup")}
        >
          <Text style={styles.primaryBtnText}>Los geht's</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.replace("/location-setup")}
        >
          <Text style={styles.skipText}>Bereits registriert? Anmelden</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  iconCluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  bubbleLeft: {
    backgroundColor: Colors.light.tintBlue,
    transform: [{ translateX: 8 }, { translateY: 6 }],
    zIndex: 1,
  },
  bubbleCenter: {
    backgroundColor: Colors.light.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    zIndex: 3,
  },
  bubbleRight: {
    backgroundColor: Colors.light.tint,
    transform: [{ translateX: -8 }, { translateY: 6 }],
    zIndex: 2,
  },
  appName: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  featuresSection: {
    gap: 20,
    paddingVertical: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.separator,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  ctaSection: {
    gap: 12,
    paddingTop: 28,
    alignItems: "stretch",
  },
  primaryBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  skipBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
});
