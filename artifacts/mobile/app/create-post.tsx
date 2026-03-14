import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
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

import { Avatar } from "@/components/Avatar";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const SUGGESTED_LOCATIONS = [
  "Brooklyn, NY",
  "Williamsburg Bridge",
  "Park Slope, Brooklyn",
  "Astoria Park",
  "Bedford Ave, Brooklyn",
  "Central Park, NYC",
  "High Line, Manhattan",
];

export default function CreatePostScreen() {
  const { currentUser, addPost } = useApp();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [locationFocused, setLocationFocused] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const textRef = useRef<TextInput>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canPost = content.trim().length > 0 && location.trim().length > 0;

  const handlePost = () => {
    if (!canPost) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addPost(content.trim(), location.trim());
    router.back();
  };

  const filteredLocations = SUGGESTED_LOCATIONS.filter((l) =>
    l.toLowerCase().includes(location.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.topBar, { paddingTop: topPad + 6 }]}>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>New Post</Text>
        <Pressable
          style={({ pressed }) => [
            styles.postBtn,
            !canPost && styles.postBtnDisabled,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handlePost}
          disabled={!canPost}
        >
          <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>
            Post
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.composerRow}>
          <Avatar uri={currentUser.avatar} size={44} />
          <View style={styles.composerRight}>
            <Text style={styles.composerName}>{currentUser.name}</Text>
            <TextInput
              ref={textRef}
              style={styles.textInput}
              placeholder="What's happening in your neighborhood?"
              placeholderTextColor={Colors.light.placeholder}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.charCount}>
          <Text style={[styles.charText, content.length > 450 && styles.charTextWarn]}>
            {500 - content.length} characters remaining
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Feather name="map-pin" size={16} color={Colors.light.tint} />
            <Text style={styles.locationLabel}>Location</Text>
          </View>
          <View
            style={[
              styles.locationInputWrap,
              locationFocused && styles.locationInputFocused,
            ]}
          >
            <TextInput
              style={styles.locationInput}
              placeholder="Add your location..."
              placeholderTextColor={Colors.light.placeholder}
              value={location}
              onChangeText={(t) => {
                setLocation(t);
                setShowLocationSuggestions(t.length > 0);
              }}
              onFocus={() => {
                setLocationFocused(true);
                setShowLocationSuggestions(location.length > 0);
              }}
              onBlur={() => {
                setLocationFocused(false);
                setTimeout(() => setShowLocationSuggestions(false), 150);
              }}
            />
            {location.length > 0 && (
              <Pressable
                onPress={() => {
                  setLocation("");
                  setShowLocationSuggestions(false);
                }}
              >
                <Feather name="x" size={14} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>

          {showLocationSuggestions && filteredLocations.length > 0 && (
            <View style={styles.suggestions}>
              {filteredLocations.map((loc) => (
                <Pressable
                  key={loc}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    { backgroundColor: pressed ? Colors.light.backgroundSecondary : Colors.light.background },
                  ]}
                  onPress={() => {
                    setLocation(loc);
                    setShowLocationSuggestions(false);
                  }}
                >
                  <Feather name="map-pin" size={13} color={Colors.light.textTertiary} />
                  <Text style={styles.suggestionText}>{loc}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.addMediaRow}>
          <Pressable style={styles.mediaBtn}>
            <Feather name="image" size={18} color={Colors.light.textSecondary} />
            <Text style={styles.mediaBtnText}>Photo</Text>
          </Pressable>
          <Pressable style={styles.mediaBtn}>
            <Feather name="smile" size={18} color={Colors.light.textSecondary} />
            <Text style={styles.mediaBtnText}>Feeling</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  topTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  postBtn: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: {
    backgroundColor: Colors.light.backgroundTertiary,
  },
  postBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  postBtnTextDisabled: {
    color: Colors.light.placeholder,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 16,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    gap: 12,
  },
  composerRight: {
    flex: 1,
    gap: 4,
  },
  composerName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  textInput: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    minHeight: 120,
    lineHeight: 24,
    paddingTop: 4,
  },
  charCount: {
    paddingHorizontal: 72,
    paddingBottom: 12,
  },
  charText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  charTextWarn: {
    color: Colors.light.tint,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  locationSection: {
    paddingHorizontal: 16,
    gap: 10,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 8,
  },
  locationInputFocused: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.background,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  suggestions: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.separator,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  addMediaRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  mediaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
  },
  mediaBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
});
