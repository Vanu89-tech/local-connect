import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { TimeAgo } from "@/components/TimeAgo";
import Colors from "@/constants/colors";
import { Post, useApp } from "@/context/AppContext";

type Props = {
  post: Post;
};

export function PostCard({ post }: Props) {
  const { toggleLike } = useApp();
  const heartScale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    toggleLike(post.id);
  };

  const handlePostPress = () => {
    router.push({ pathname: "/post/[id]", params: { id: post.id } });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.userRow}
          onPress={() =>
            router.push({ pathname: "/user/[id]", params: { id: post.userId } })
          }
        >
          <Avatar uri={post.user.avatar} size={40} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{post.user.name}</Text>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={10} color={Colors.light.textTertiary} />
              <Text style={styles.locationText}>{post.location}</Text>
              <Text style={styles.dotSep}>·</Text>
              <TimeAgo date={post.createdAt} style={styles.timeText} />
            </View>
          </View>
        </Pressable>
        <Pressable style={styles.moreBtn}>
          <Feather name="more-horizontal" size={18} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      <Pressable onPress={handlePostPress}>
        <Text style={styles.content}>{post.content}</Text>
        {post.imageUrl && (
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
      </Pressable>

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Feather
              name="heart"
              size={20}
              color={post.liked ? Colors.light.like : Colors.light.textSecondary}
              style={post.liked && styles.likedIcon}
            />
          </Animated.View>
          <Text style={[styles.actionCount, post.liked && styles.likedText]}>
            {post.likesCount}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={handlePostPress}>
          <Feather name="message-circle" size={20} color={Colors.light.textSecondary} />
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </Pressable>

        <Pressable style={styles.actionBtn}>
          <Feather name="share" size={20} color={Colors.light.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.card,
    paddingTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  dotSep: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginHorizontal: 2,
  },
  timeText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  moreBtn: {
    padding: 4,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 260,
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
    borderRadius: 20,
  },
  actionCount: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  likedIcon: {},
  likedText: {
    color: Colors.light.like,
  },
});
