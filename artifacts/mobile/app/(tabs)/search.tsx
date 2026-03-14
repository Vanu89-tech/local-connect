import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
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

const LOCATIONS = [
  "Brooklyn, NY", "Williamsburg", "Park Slope", "Astoria", "Manhattan",
  "DUMBO", "Greenpoint", "Bushwick", "Lower East Side", "Harlem",
];

export default function SearchScreen() {
  const { posts } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filteredPosts = query.trim().length > 0
    ? posts.filter(
        (p) =>
          p.content.toLowerCase().includes(query.toLowerCase()) ||
          p.location.toLowerCase().includes(query.toLowerCase()) ||
          p.user.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const renderItem = ({ item }: { item: Post }) => <PostCard post={item} />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={styles.title}>Explore</Text>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={Colors.light.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts, people, places..."
            placeholderTextColor={Colors.light.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={Colors.light.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {query.trim().length === 0 ? (
        <FlatList
          data={LOCATIONS}
          keyExtractor={(item) => item}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <Text style={styles.sectionLabel}>Popular Neighborhoods</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.locationChip, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setQuery(item)}
            >
              <Feather name="map-pin" size={14} color={Colors.light.tint} />
              <Text style={styles.locationText}>{item}</Text>
              <Feather name="chevron-right" size={14} color={Colors.light.textTertiary} style={{ marginLeft: "auto" }} />
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      ) : filteredPosts.length > 0 ? (
        <FlatList
          data={filteredPosts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noResults}>
          <Feather name="search" size={36} color={Colors.light.placeholder} />
          <Text style={styles.noResultsTitle}>No results</Text>
          <Text style={styles.noResultsDesc}>
            Try searching a different term or neighborhood
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: Colors.light.background,
  },
  locationText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginLeft: 40,
  },
  noResults: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  noResultsDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
