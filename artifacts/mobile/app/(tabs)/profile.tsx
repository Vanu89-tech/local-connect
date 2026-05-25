import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostCard } from "@/components/PostCard";
import Colors from "@/constants/colors";
import { Post, useApp } from "@/context/AppContext";
import { useLocation } from "@/context/LocationContext";

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { currentUser, posts, updateProfileLocation } = useApp();
  const { homeLocation, setHomeLocation, refreshLocation } = useLocation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [editOpen, setEditOpen] = useState(false);
  const [addressInput, setAddressInput] = useState(homeLocation?.address ?? "");
  const [savingAddress, setSavingAddress] = useState(false);

  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === currentUser.id),
    [posts, currentUser.id],
  );

  const renderItem = useCallback(({ item }: { item: Post }) => <PostCard post={item} />, []);

  useEffect(() => {
    if (!editOpen) {
      setAddressInput(homeLocation?.address ?? "");
    }
  }, [editOpen, homeLocation?.address]);

  const saveAddress = async () => {
    const address = addressInput.trim();
    if (!address) {
      Alert.alert("Adresse fehlt", "Gib deine Adresse ein, damit Locals deinen Heimbereich setzen kann.");
      return;
    }

    setSavingAddress(true);
    try {
      const results = await Location.geocodeAsync(address);
      const first = results[0];
      if (!first) {
        Alert.alert("Nicht gefunden", "Versuche es mit Straße, Hausnummer und Stadt.");
        return;
      }

      const reverse = await Location.reverseGeocodeAsync({
        latitude: first.latitude,
        longitude: first.longitude,
      });
      const place = reverse[0];
      const name = [place?.district || place?.subregion, place?.city]
        .filter(Boolean)
        .join(", ") || place?.city || "Daheim";

      await setHomeLocation({
        name,
        address,
        lat: first.latitude,
        lng: first.longitude,
      });
      await updateProfileLocation(name);
      await refreshLocation();
      setEditOpen(false);
    } catch (error) {
      console.warn("profile address save failed", error);
      Alert.alert("Adresse konnte nicht gespeichert werden", "Prüfe die Adresse und versuche es nochmal.");
    } finally {
      setSavingAddress(false);
    }
  };

  const ListHeader = () => (
    <View>
      <View style={[styles.headerBg, { paddingTop: topPad + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
          </View>
          <View style={styles.statsRow}>
            <StatPill value={myPosts.length} label="Posts" />
            <StatPill value={currentUser.followersCount} label="Followers" />
            <StatPill value={currentUser.followingCount} label="Following" />
          </View>
        </View>

        <View style={styles.userDetails}>
          <Text style={styles.displayName}>{currentUser.name}</Text>
          <Text style={styles.username}>@{currentUser.username}</Text>
          {currentUser.bio ? (
            <Text style={styles.bio}>{currentUser.bio}</Text>
          ) : null}
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.locationText}>{currentUser.location}</Text>
          </View>
        </View>

        <View style={styles.profileActions}>
          <Pressable
            style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setEditOpen(true)}
          >
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.onboardBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push("/onboarding")}
          >
            <Feather name="info" size={16} color={Colors.light.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.postsHeader}>
        <Feather name="grid" size={14} color={Colors.light.text} />
        <Text style={styles.postsHeaderText}>Posts</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="camera" size={32} color={Colors.light.textTertiary} />
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptyDesc}>Share your first local moment.</Text>
      <Pressable
        style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push("/create-post")}
      >
        <Text style={styles.emptyBtnText}>Create post</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={myPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!myPosts.length}
      />
      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.editSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Profil bearbeiten</Text>
              <Pressable style={styles.closeButton} onPress={() => setEditOpen(false)}>
                <Feather name="x" size={18} color={Colors.light.text} />
              </Pressable>
            </View>

            <Text style={styles.sheetLabel}>Deine Adresse</Text>
            <TextInput
              style={styles.addressInput}
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder="Straße, Hausnummer, Stadt"
              placeholderTextColor={Colors.light.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveAddress}
            />
            <Text style={styles.addressHint}>
              Wird nur für deinen 500-Meter-Heimbereich genutzt und nicht öffentlich angezeigt.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || savingAddress) && { opacity: 0.78 },
              ]}
              disabled={savingAddress}
              onPress={saveAddress}
            >
              {savingAddress ? (
                <ActivityIndicator color={Colors.light.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Adresse speichern</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerBg: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statPill: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  userDetails: {
    gap: 4,
  },
  displayName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  username: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  bio: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    lineHeight: 20,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
  },
  editBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  onboardBtn: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
  },
  postsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  postsHeaderText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.onPrimary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  editSheet: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
  },
  sheetLabel: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  addressInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator + "77",
    backgroundColor: Colors.light.background,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  addressHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.primary,
    borderWidth: 0,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onPrimary,
  },
});
