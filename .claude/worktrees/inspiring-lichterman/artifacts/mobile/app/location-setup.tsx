import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useLocation } from "@/context/LocationContext";

export default function LocationSetupScreen() {
  const insets = useSafeAreaInsets();
  const { setHomeLocation, requestGpsPermission } = useLocation();
  const [homeInput, setHomeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeHome = async (name: string) => {
    const results = await Location.geocodeAsync(name);
    if (!results.length) throw new Error("not_found");
    return { name, lat: results[0].latitude, lng: results[0].longitude };
  };

  const finishSetup = async (withGps: boolean) => {
    const trimmed = homeInput.trim();
    if (!trimmed) {
      setError("Bitte gib dein Heimviertel oder deine Stadt ein.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loc = await geocodeHome(trimmed);
      await setHomeLocation(loc);
      if (withGps) {
        await requestGpsPermission();
      }
      await AsyncStorage.setItem("locals_onboarding_seen", "1");
      router.replace("/");
    } catch (e: any) {
      if (e.message === "not_found") {
        setError("Ort nicht gefunden. Versuche es mit Viertel, Stadt oder PLZ.");
      } else {
        setError("Fehler beim Einrichten. Bitte versuche es erneut.");
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Feather name="map-pin" size={36} color={Colors.light.primary} />
        </View>

        <Text style={styles.title}>Dein Heimbereich</Text>
        <Text style={styles.subtitle}>
          Locals zeigt dir, was in deiner Nähe passiert. Damit du{" "}
          <Text style={styles.bold}>zuhause anonym bleibst</Text>, legst du jetzt
          dein Heimviertel fest — deine genaue Adresse bleibt privat.
        </Text>

        {/* Home input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Dein Heimviertel oder Stadt</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="z.B. Schwabing, München"
            placeholderTextColor={Colors.light.textTertiary}
            value={homeInput}
            onChangeText={(t) => {
              setHomeInput(t);
              setError(null);
            }}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => finishSetup(true)}
          />
          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <Text style={styles.hint}>
            Wenn du in diesem Bereich bist, wird nur der Name dieses Viertels
            geteilt — nicht dein genauer Standort.
          </Text>
        </View>

        {/* Privacy info */}
        <View style={styles.privacyBox}>
          <Feather name="shield" size={16} color={Colors.light.tintBlue} />
          <Text style={styles.privacyText}>
            Unterwegs siehst du echte lokale Posts. Zuhause bleibst du anonym.
            Dein Live-Standort wird niemals an andere weitergegeben.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed || loading ? 0.82 : 1 },
            ]}
            onPress={() => finishSetup(true)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Feather name="navigation" size={17} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Live-Standort aktivieren
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed || loading ? 0.7 : 1 },
            ]}
            onPress={() => finishSetup(false)}
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>
              Nur Heimviertel verwenden
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  inputSection: {
    marginBottom: 20,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.light.separator,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#EF4444",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    lineHeight: 17,
  },
  privacyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FAFA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 32,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  buttons: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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
});
