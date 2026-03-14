import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { TimeAgo } from "@/components/TimeAgo";
import Colors from "@/constants/colors";
import { Comment, useApp } from "@/context/AppContext";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPostById, getCommentsForPost, addComment, toggleLike, currentUser } =
    useApp();
  const insets = useSafeAreaInsets();

  const [commentText, setCommentText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const heartScale = useRef(new Animated.Value(1)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const post = getPostById(id);
  const comments = getCommentsForPost(id);

  const handleLike = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.4,
        useNativeDriver: true,
        speed: 60,
        bounciness: 14,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
      }),
    ]).start();
    toggleLike(id);
  }, [id, heartScale, toggleLike]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 350);
  }, []);

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    Animated.timing(inputBorderAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [inputBorderAnim]);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    Animated.timing(inputBorderAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [inputBorderAnim]);

  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim()) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    addComment(id, commentText.trim());
    setCommentText("");
    inputRef.current?.blur();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [id, commentText, addComment]);

  if (!post) {
    return (
      <View style={styles.notFound}>
        <Feather name="alert-circle" size={40} color={Colors.light.textTertiary} />
        <Text style={styles.notFoundTitle}>Post not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.notFoundBack}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const borderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.light.separator, Colors.light.primary],
  });

  const PostDetailHeader = () => (
    <View style={styles.postDetail}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <Pressable
          style={styles.authorLeft}
          onPress={() =>
            router.push({ pathname: "/user/[id]", params: { id: post.userId } })
          }
        >
          <Avatar uri={post.user.avatar} size={46} showRing />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.user.name}</Text>
            <Text style={styles.authorUsername}>@{post.user.username}</Text>
          </View>
        </Pressable>
        <Pressable style={styles.moreBtn}>
          <Feather name="more-horizontal" size={20} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      {/* Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Image */}
      {post.imageUrl && (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.image}
            contentFit="cover"
          />
        </View>
      )}

      {/* Meta row: location + time */}
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={13} color={Colors.light.tint} />
        <Text style={styles.metaLocation}>{post.location}</Text>
        <Text style={styles.metaDot}>·</Text>
        <TimeAgo date={post.createdAt} style={styles.metaTime} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {post.likesCount > 0 && (
          <Text style={styles.statsText}>
            <Text style={styles.statsNum}>{post.likesCount}</Text>
            {" "}
            {post.likesCount === 1 ? "like" : "likes"}
          </Text>
        )}
        {post.commentsCount > 0 && (
          <Pressable onPress={focusInput}>
            <Text style={styles.statsText}>
              <Text style={styles.statsNum}>{post.commentsCount}</Text>
              {" "}
              {post.commentsCount === 1 ? "comment" : "comments"}
            </Text>
          </Pressable>
        )}
      </View>

      {(post.likesCount > 0 || post.commentsCount > 0) && (
        <View style={styles.statsDivider} />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Feather
              name={post.liked ? "heart" : "heart"}
              size={22}
              color={post.liked ? Colors.light.like : Colors.light.textSecondary}
            />
          </Animated.View>
          <Text style={[styles.actionLabel, post.liked && styles.actionLabelLiked]}>
            {post.liked ? "Liked" : "Like"}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={focusInput}>
          <Feather name="message-circle" size={22} color={Colors.light.textSecondary} />
          <Text style={styles.actionLabel}>Comment</Text>
        </Pressable>

        <Pressable style={styles.actionBtn}>
          <Feather name="share-2" size={22} color={Colors.light.textSecondary} />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>

      {/* Comments heading */}
      <View style={styles.commentsHeading}>
        <Text style={styles.commentsTitle}>
          {comments.length === 0
            ? "Comments"
            : `${comments.length} ${comments.length === 1 ? "Comment" : "Comments"}`}
        </Text>
        {comments.length === 0 && (
          <Pressable onPress={focusInput}>
            <Text style={styles.beFirstText}>Be the first</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderComment = useCallback(
    ({ item, index }: { item: Comment; index: number }) => (
      <CommentRow comment={item} isLast={index === comments.length - 1} />
    ),
    [comments.length]
  );

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={comments}
        renderItem={renderComment}
        keyExtractor={keyExtractor}
        ListHeaderComponent={<PostDetailHeader />}
        ListEmptyComponent={
          <View style={styles.noComments}>
            <View style={styles.noCommentsIcon}>
              <Feather
                name="message-circle"
                size={26}
                color={Colors.light.textTertiary}
              />
            </View>
            <Text style={styles.noCommentsText}>No comments yet</Text>
            <Pressable onPress={focusInput}>
              <Text style={styles.noCommentsAction}>Write the first comment →</Text>
            </Pressable>
          </View>
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
      />

      {/* Comment input bar */}
      <Animated.View
        style={[
          styles.inputBar,
          { paddingBottom: bottomPad + 8, borderTopColor: borderColor },
        ]}
      >
        <Avatar uri={currentUser.avatar} size={34} />
        <View style={styles.inputInner}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={inputFocused ? "Add your comment…" : "Add a comment…"}
            placeholderTextColor={Colors.light.placeholder}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={280}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            returnKeyType="default"
          />
          {commentText.trim().length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleSubmitComment}
            >
              <Feather name="send" size={15} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment,
  isLast,
}: {
  comment: Comment;
  isLast: boolean;
}) {
  return (
    <View style={[commentStyles.row, !isLast && commentStyles.rowBorder]}>
      <Avatar uri={comment.user.avatar} size={36} />
      <View style={commentStyles.body}>
        <View style={commentStyles.topLine}>
          <Text style={commentStyles.name}>{comment.user.name}</Text>
          <TimeAgo date={comment.createdAt} style={commentStyles.time} />
        </View>
        <Text style={commentStyles.content}>{comment.content}</Text>
      </View>
    </View>
  );
}

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  content: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    lineHeight: 21,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  listContent: {
    paddingBottom: 12,
  },

  // Not found state
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  notFoundBack: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.tint,
  },

  // Post detail header
  postDetail: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
    paddingBottom: 4,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  authorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  authorInfo: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  authorUsername: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  moreBtn: {
    padding: 6,
  },
  content: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  imageWrap: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 280,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  metaLocation: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.tint,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginHorizontal: 2,
  },
  metaTime: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  statsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  statsNum: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  actionLabelLiked: {
    color: Colors.light.like,
  },
  commentsHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.separator,
  },
  commentsTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  beFirstText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.tint,
  },

  // Empty state
  noComments: {
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 24,
    gap: 8,
  },
  noCommentsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  noCommentsText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  noCommentsAction: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.tint,
    marginTop: 2,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    backgroundColor: Colors.light.background,
    gap: 8,
  },
  inputInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 42,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
});
