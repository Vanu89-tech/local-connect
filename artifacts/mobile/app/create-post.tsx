import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { PostCategory, useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { supabase } from "@/lib/supabase";

const POST_IMAGES_BUCKET = "post-images";

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

const POST_CATEGORIES: { value: PostCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "general", label: "Allgemein", icon: "message-circle" },
  { value: "question", label: "Frage", icon: "help-circle" },
  { value: "event", label: "Event", icon: "calendar" },
  { value: "recommendation", label: "Tipp", icon: "star" },
  { value: "found", label: "Gefunden", icon: "search" },
  { value: "warning", label: "Warnung", icon: "alert-triangle" },
  { value: "party", label: "Party", icon: "music" },
];

function getPostBlockReason(text: string): string | null {
  const normalized = text.trim();
  if (normalized.length < 3) return "Schreib mindestens 3 Zeichen.";

  const phonePattern = /(?:\+?\d[\s().-]*){7,}/;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const mostlyLinkPattern = /^https?:\/\/\S+$/i;

  if (emailPattern.test(normalized)) {
    return "Bitte poste keine Email-Adressen. Teile Kontaktdaten erst privat.";
  }

  if (phonePattern.test(normalized)) {
    return "Bitte poste keine Telefonnummern. Teile Kontaktdaten erst privat.";
  }

  if (mostlyLinkPattern.test(normalized)) {
    return "Nur ein Link reicht nicht. Schreib kurz dazu, warum es lokal relevant ist.";
  }

  return null;
}

export default function CreatePostScreen() {
  const { user } = useAuth();
  const { currentUser, addPost } = useApp();
  const { currentLocationName, effectivePresenceMode, homeLocation, refreshLocation } =
    useLocation();
  const insets = useSafeAreaInsets();
  const textRef = useRef<TextInput>(null);

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationFocused, setLocationFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [category, setCategory] = useState<PostCategory>("general");
  const [postError, setPostError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const blockReason = getPostBlockReason(content);
  const canPost = !blockReason && location.trim().length > 0;

  const myLocationName = currentLocationName ?? homeLocation?.name ?? null;
  const locationOptions = useMemo(() => {
    const options = myLocationName
      ? [myLocationName, ...LOCATION_CHIPS.filter((loc) => loc !== myLocationName)]
      : LOCATION_CHIPS;
    return Array.from(new Set(options));
  }, [myLocationName]);

  const filteredChips = locationQuery.length > 0
    ? locationOptions.filter((l) =>
        l.toLowerCase().includes(locationQuery.toLowerCase())
      )
    : locationOptions;

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    if (!myLocationName || location || locationQuery) return;
    setLocation(myLocationName);
    setLocationQuery(myLocationName);
  }, [location, locationQuery, myLocationName]);

  const uploadSelectedImageIfNeeded = async (): Promise<string | undefined> => {
    if (!selectedImage) return undefined;
    if (/^https?:\/\//i.test(selectedImage.uri)) return selectedImage.uri;
    if (!user) return selectedImage.uri;

    const response = await fetch(selectedImage.uri);
    const blob = await response.blob();
    const mimeType = selectedImage.mimeType ?? blob.type ?? "image/jpeg";
    const extension =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/heic"
          ? "heic"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";

    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error } = await supabase.storage.from(POST_IMAGES_BUCKET).upload(filePath, blob, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Foto-Upload fehlgeschlagen: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(POST_IMAGES_BUCKET)
      .getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  };

  const handlePost = async () => {
    if (!canPost || isPosting) return;
    setIsPosting(true);
    setPostError(null);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      const uploadedImageUrl = await uploadSelectedImageIfNeeded();
      await addPost(content.trim(), location.trim(), uploadedImageUrl, category);
      router.back();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Post konnte nicht erstellt werden.");
    } finally {
      setIsPosting(false);
    }
  };

  const handlePickImage = (asset: { uri: string; mimeType?: string | null }) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedImage({ uri: asset.uri, mimeType: asset.mimeType ?? null });
    setShowImagePicker(false);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Keine Berechtigung", "Bitte erlaube Zugriff auf deine Mediathek.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets.length) return;
    handlePickImage(result.assets[0]);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Keine Berechtigung", "Bitte erlaube Zugriff auf die Kamera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets.length) return;
    handlePickImage(result.assets[0]);
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

  if (effectivePresenceMode === "home") {
    return (
      <View style={[styles.passiveContainer, { paddingTop: topPad + 24 }]}>
        <View style={styles.passiveIcon}>
          <Feather name="home" size={34} color={Colors.light.primary} />
        </View>
        <Text style={styles.passiveTitle}>Daheim-Modus</Text>
        <Text style={styles.passiveText}>
          Du bist gerade passiv unterwegs. Du kannst Posts und Karte ansehen,
          aber erst im Online-Modus selbst posten.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.passiveButton, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.passiveButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

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
                  source={{ uri: selectedImage.uri }}
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
                <Text style={styles.imagePickerLabel}>Foto auswählen</Text>
                <View style={styles.imagePickerActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.imagePickerActionBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => void pickFromCamera()}
                  >
                    <Feather name="camera" size={16} color={Colors.light.text} />
                    <Text style={styles.imagePickerActionText}>Kamera</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.imagePickerActionBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => void pickFromLibrary()}
                  >
                    <Feather name="image" size={16} color={Colors.light.text} />
                    <Text style={styles.imagePickerActionText}>Mediathek</Text>
                  </Pressable>
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

        <View style={styles.safetyNotice}>
          <Feather name="shield" size={16} color={Colors.light.tintBlue} />
          <Text style={styles.safetyText}>
            Poste nur lokale, respektvolle Inhalte. Keine Telefonnummern,
            Email-Adressen oder privaten Daten anderer Personen.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Kategorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {POST_CATEGORIES.map((item) => {
              const selected = category === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setCategory(item.value);
                  }}
                >
                  <Feather
                    name={item.icon}
                    size={13}
                    color={selected ? "#FFFFFF" : Colors.light.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      selected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
                  loc === myLocationName && styles.myLocationChip,
                  location === loc && styles.chipSelected,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => handleSelectLocation(loc)}
              >
                <Feather
                  name={loc === myLocationName ? "navigation" : "map-pin"}
                  size={11}
                  color={location === loc ? "#FFFFFF" : Colors.light.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    location === loc && styles.chipTextSelected,
                  ]}
                >
                  {loc === myLocationName ? `Meine Gegend: ${loc}` : loc}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {(blockReason || postError) && (
          <Text style={styles.errorText}>{postError ?? blockReason}</Text>
        )}

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
                {blockReason ?? "Pick a location to continue"}
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
  passiveContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  passiveIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  passiveTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    textAlign: "center",
  },
  passiveText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  passiveButton: {
    marginTop: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  passiveButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onPrimary,
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
    color: Colors.light.onPrimary,
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
  imagePickerActions: {
    flexDirection: "row",
    gap: 10,
  },
  imagePickerActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.separator,
    borderRadius: 10,
    paddingVertical: 12,
  },
  imagePickerActionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
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

  safetyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
  },
  safetyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },

  // Category
  categorySection: {
    gap: 10,
  },
  categoryTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    paddingHorizontal: 16,
  },
  categoryScroll: {
    marginHorizontal: -16,
  },
  categoryContent: {
    paddingHorizontal: 32,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.separator,
  },
  categoryChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.light.onPrimary,
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
  myLocationChip: {
    borderColor: Colors.light.tintBlue + "66",
    backgroundColor: Colors.light.tintBlue + "14",
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
    color: Colors.light.onPrimary,
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
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.tint,
    textAlign: "center",
    marginHorizontal: 16,
    lineHeight: 18,
  },
});
