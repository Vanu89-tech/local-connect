import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { LocationProvider } from "@/context/LocationContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const seen = await AsyncStorage.getItem("locals_onboarding_seen");
        if (!seen) {
          router.replace("/onboarding");
          return;
        }
        // If onboarding seen but location never set up, send to location setup
        const locData = await AsyncStorage.getItem("locals_location");
        if (!locData) {
          router.replace("/location-setup");
        }
      } catch (_) {}
    };
    checkOnboarding();
  }, []);

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
          headerTintColor: "#1A1A2E",
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
          headerStyle: { backgroundColor: "#FFFFFF" },
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
    </Stack>
  );
}

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
          <LocationProvider>
            <AppProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AppProvider>
          </LocationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
