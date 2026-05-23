import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LocationProvider, useLocation } from "@/context/LocationContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { loading, session } = useAuth();
  const { hasSelectedStartMode } = useLocation();
  const segments = useSegments();
  const segmentKey = useMemo(() => segments.join("/"), [segments]);

  useEffect(() => {
    let cancelled = false;

    const replaceIfCurrent = (href: Href) => {
      if (!cancelled) router.replace(href);
    };

    const checkOnboarding = async () => {
      if (loading) return;

      try {
        const rootSegment = segmentKey.split("/")[0];
        const inAuthGroup = rootSegment === "(auth)";
        const onOnboarding = rootSegment === "onboarding";
        const onLocationSetup = rootSegment === "location-setup";
        const onPresenceChoice = rootSegment === "presence-choice";

        const seen = await AsyncStorage.getItem("locals_onboarding_seen");
        if (cancelled) return;

        if (!seen) {
          if (!onOnboarding) replaceIfCurrent("/onboarding");
          return;
        }

        if (!session && !inAuthGroup) {
          replaceIfCurrent("/(auth)/login");
          return;
        }

        if (!session) return;

        // If onboarding seen but location never set up, send to location setup
        const locData = await AsyncStorage.getItem("locals_location");
        if (cancelled) return;

        if (!locData && !onLocationSetup) {
          replaceIfCurrent("/location-setup");
          return;
        }

        if (locData) {
          const parsedLoc = JSON.parse(locData);
          const hasAddress =
            typeof parsedLoc?.homeLocation?.address === "string" &&
            parsedLoc.homeLocation.address.trim().length > 0;
          if (!hasAddress && !onLocationSetup) {
            replaceIfCurrent("/location-setup");
            return;
          }
          if (!hasAddress) return;
        }

        if (locData && !hasSelectedStartMode && !onPresenceChoice) {
          replaceIfCurrent("/presence-choice");
          return;
        }

        if (inAuthGroup) {
          replaceIfCurrent("/");
        }
      } catch (error) {
        console.warn("Startup routing failed", error);
        replaceIfCurrent("/location-setup");
      }
    };
    checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [hasSelectedStartMode, loading, segmentKey, session]);

  if (loading) {
    return (
      <View style={styles.bootScreen}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="(auth)"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="post/[id]"
        options={{
          title: "Post",
          headerBackTitle: "Back",
          headerTintColor: Colors.light.text,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.light.backgroundSecondary },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="create-post"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="location-setup"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="presence-choice"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocationProvider>
              <AppProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AppProvider>
            </LocationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
