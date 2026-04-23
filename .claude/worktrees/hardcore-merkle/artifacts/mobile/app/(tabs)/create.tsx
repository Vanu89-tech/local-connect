import { router, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { View } from "react-native";

export default function CreateTabScreen() {
  useFocusEffect(
    useCallback(() => {
      router.navigate("/(tabs)");
      const t = setTimeout(() => {
        router.push("/create-post");
      }, 80);
      return () => clearTimeout(t);
    }, [])
  );
  return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
}
