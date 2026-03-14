import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
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

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80",
  "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=600&q=80",
  "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&q=80",
  "https://images.unsplash.com/photo-1555441228-c6b67a8081bf?w=600&q=80",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80",
  "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=600&q=80",
];

const LOCATION_CHIPS = [
  "Brooklyn, NY",
  "Williamsburg Bridge",
  "Park Slope, Brooklyn",
  "Astoria Park",
  "Bedford Ave, Brooklyn",
  "Central Park, NYC",
  "High Line, Manhattan",
  "East Village, NYC",
  "DUMBO, Brooklyn",
  "Flushing, Queens",
];

export default function CreatePostScreen() {
  const { currentUser, addPost } = useApp();
  const insets = useSafeAreaInsets();
  const textRef = useRef<TextInput>(null);

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationFocused, setLocationFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canPost = content.trim().length > 0 && location.trim().length > 0;

  const filteredChips = locationQuery.length > 0
    ? LOCATION_CHIPS.filter((l) =>
        l.toLowerCase().includes(locationQuery.toLowerCase())
      )
    : LOCATION_CHIPS;

  const handlePost = async () => {
    if (!canPost || isPosting) return;
    setIsPosting(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    addPost(content.trim(), location.trim(), selectedImage ?? undefined);
    router.back();
  };

  const handlePickImage = (url: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedImage(url);
    setShowImagePicker(false);
  };

  const handleRemoveImage = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(null);
  };

  const handleSelectLocation = (loc: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setLocation(loc);
    setLocationQuery(loc);
    setLocationFocused(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
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
            { opacity: pressed && canPost ? 0.85 : 1 },
          ]}
          onPress={handlePost}
          disabled={!canPost || isPosting}
        >
          <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>
            {isPosting ? "Posting…" : "Post"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Composer row */}
        <View style={styles.composerRow}>
          <View style={styles.avatarCol}>
            <Avatar uri={currentUser.avatar} size={44} />
            <View style={styles.threadLine} />
          </View>
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
            {content.length > 0 && (
              <Text style={[styles.charText, content.length > 450 && styles.charTextWarn]}>
                {500 - content.length}
              </Text>
            )}

            {/* Selected image preview */}
            {selectedImage && (
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <Pressable style={styles.removeImageBtn} onPress={handleRemoveImage}>
                  <View style={styles.removeImageInner}>
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            )}

            {/* Image picker grid */}
            {showImagePicker && (
              <View style={styles.imagePickerWrap}>
                <Text style={styles.imagePickerLabel}>Choose a photo</Text>
                <View style={styles.imageGrid}>
                  {SAMPLE_IMAGES.map((url, i) => (
                    <Pressable
                      key={url}
                      style={({ pressed }) => [
                        styles.imageGridItem,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                      onPress={() => handlePickImage(url)}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.imageGridThumb}
                        contentFit="cover"
                      />
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  style={styles.cancelPickerBtn}
                  onPress={() => setShowImagePicker(false)}
                >
                  <Text style={styles.cancelPickerText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Location section */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Feather name="map-pin" size={15} color={Colors.light.tint} />
            <Text style={styles.locationLabel}>Area tag</Text>
            {location.length > 0 && (
              <View style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{location}</Text>
                <Pressable
                  onPress={() => {
                    setLocation("");
                    setLocationQuery("");
                  }}
                >
                  <Feather name="x" size={12} color={Colors.light.tint} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Search input */}
          <View
            style={[
              styles.locationInputWrap,
              locationFocused && styles.locationInputFocused,
            ]}
          >
            <Feather
              name="search"
              size={14}
              color={locationFocused ? Colors.light.primary : Colors.light.textTertiary}
            />
            <TextInput
              style={styles.locationInput}
              placeholder="Search or pick a location…"
              placeholderTextColor={Colors.light.placeholder}
              value={locationQuery}
              onChangeText={(t) => {
                setLocationQuery(t);
                if (t !== location) setLocation("");
              }}
              onFocus={() => setLocationFocused(true)}
              onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
            />
            {locationQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setLocationQuery("");
                  setLocation("");
                }}
              >
                <Feather name="x" size={14} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Chips / suggestions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {filteredChips.map((loc) => (
              <Pressable
                key={loc}
                style={({ pressed }) => [
                  styles.chip,
                  location === loc && styles.chipSelected,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => handleSelectLocation(loc)}
              >
                <Feather
                  name="map-pin"
                  size={11}
                  color={location === loc ? "#FFFFFF" : Colors.light.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    location === loc && styles.chipTextSelected,
                  ]}
                >
                  {loc}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Bottom toolbar */}
        <View style={styles.toolbar}>
          <Pressable
            style={({ pressed }) => [
              styles.toolbarBtn,
              selectedImage != null && styles.toolbarBtnActive,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              if (selectedImage) {
                handleRemoveImage();
              } else {
                setShowImagePicker(!showImagePicker);
              }
            }}
          >
            <Feather
              name={selectedImage ? "image" : "camera"}
              size={20}
              color={selectedImage ? Colors.light.tint : Colors.light.textSecondary}
            />
            <Text
              style={[
                styles.toolbarBtnText,
                selectedImage != null && styles.toolbarBtnTextActive,
              ]}
            >
              {selectedImage ? "Photo added" : "Add photo"}
            </Text>
          </Pressable>

          <View style={styles.toolbarDivider} />

          <View style={styles.toolbarRight}>
            {canPost ? (
              <View style={styles.readyBadge}>
                <Feather name="check" size={13} color="#FFFFFF" />
                <Text style={styles.readyText}>Ready to post</Text>
              </View>
            ) : (
              <Text style={styles.hintText}>
                {content.trim().length === 0
                  ? "Add some text to continue"
                  : "Pick a location to continue"}
              </Text>
            )}
          </View>
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
    minWidth: 60,
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
    minWidth: 60,
    alignItems: "center",
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
    paddingTop: 18,
  },

  composerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  avatarCol: {
    alignItems: "center",
    gap: 0,
  },
  threadLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: Colors.light.separator,
    marginTop: 6,
    borderRadius: 1,
  },
  composerRight: {
    flex: 1,
    gap: 8,
    paddingBottom: 4,
  },
  composerName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginTop: 12,
  },
  textInput: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    minHeight: 110,
    lineHeight: 24,
    paddingTop: 2,
  },
  charText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "right",
    marginTop: -4,
  },
  charTextWarn: {
    color: Colors.light.tint,
    fontFamily: "Inter_600SemiBold",
  },

  // Image preview
  imagePreviewWrap: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 14,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  removeImageInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Image picker
  imagePickerWrap: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  imagePickerLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  imageGridItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  imageGridThumb: {
    width: "100%",
    height: "100%",
  },
  cancelPickerBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  cancelPickerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 16,
    marginVertical: 14,
  },

  // Location
  locationSection: {
    paddingHorizontal: 16,
    gap: 10,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  locationLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.tint + "22",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.tint + "55",
  },
  selectedChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.tint,
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
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  chipsScroll: {
    marginHorizontal: -16,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.light.separator,
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 14,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 4,
  },
  toolbarBtnActive: {},
  toolbarBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  toolbarBtnTextActive: {
    color: Colors.light.tint,
    fontFamily: "Inter_500Medium",
  },
  toolbarDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.light.separator,
  },
  toolbarRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.tintBlue,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readyText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "right",
  },
});
