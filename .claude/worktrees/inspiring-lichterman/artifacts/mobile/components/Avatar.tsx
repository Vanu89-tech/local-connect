import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";

type Props = {
  uri: string;
  size?: number;
  borderColor?: string;
  showRing?: boolean;
};

export function Avatar({ uri, size = 40, borderColor, showRing = false }: Props) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: showRing ? 2 : 0,
          borderColor: borderColor ?? Colors.light.tint,
        },
      ]}
    >
      <Image
        source={{ uri }}
        style={[styles.image, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  image: {
    backgroundColor: "#E5E7EB",
  },
});
