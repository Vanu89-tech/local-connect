import { Stack } from "expo-router";
import React from "react";

import Colors from "@/constants/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: Colors.light.text,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
        headerStyle: { backgroundColor: Colors.light.backgroundSecondary },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="register" options={{ title: "Create Account" }} />
    </Stack>
  );
}
