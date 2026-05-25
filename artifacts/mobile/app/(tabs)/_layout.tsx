import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, router } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  View,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Nachrichten</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Karte</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} />
        <Label>Create</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function CreateTabButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.createTabBtn}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.createTabInner}>
        <Feather name="plus" size={22} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

function ClassicTabLayout() {
  const safeAreaInsets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          marginHorizontal: 14,
          marginBottom: Math.max(safeAreaInsets.bottom, 10),
          height: 64,
          borderRadius: 28,
          backgroundColor: "rgba(7,19,31,0.88)",
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors.light.separator + "55",
          elevation: 0,
          shadowColor: Colors.shadow.color,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          paddingBottom: isIOS ? 8 : 10,
          paddingTop: 8,
          ...(isWeb ? { height: 70 } : {}),
        },
        tabBarBackground: () =>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "transparent" },
            ]}
          />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Nachrichten",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message" tintColor={color} size={24} />
            ) : (
              <Feather name="message-circle" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Karte",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="map" tintColor={color} size={24} />
            ) : (
              <Feather name="map" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarButton: () => (
            <CreateTabButton onPress={() => router.push("/create-post")} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  createTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createTabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: Colors.shape.borderWidthThin,
    borderColor: Colors.light.tint + "88",
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: Colors.shadow.radius,
  },
});
