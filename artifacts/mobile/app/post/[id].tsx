import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
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
import { CommentItem } from "@/components/CommentItem";
import { PostCard } from "@/components/PostCard";
import Colors from "@/constants/colors";
import { Comment, useApp } from "@/context/AppContext";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPostById, getCommentsForPost, addComment, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<TextInput>(null);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const post = getPostById(id);
  const comments = getCommentsForPost(id);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addComment(id, commentText.trim());
    setCommentText("");
    inputRef.current?.blur();
  };

  if (!post) {
    return (
      <View style={styles.notFound}>
        <Feather name="alert-circle" size={40} color={Colors.light.textTertiary} />
        <Text style={styles.notFoundText}>Post not found</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Comment }) => <CommentItem comment={item} />;

  const commentsHeader = (
    <View style={styles.commentsHeader}>
      <Text style={styles.commentsTitle}>
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        data={comments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PostCard post={post} />
            {commentsHeader}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.noComments}>
            <Feather name="message-circle" size={28} color={Colors.light.placeholder} />
            <Text style={styles.noCommentsText}>
              No comments yet. Be the first!
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <View style={[styles.inputBar, { paddingBottom: bottomPad + 8 }]}>
        <Avatar uri={currentUser.avatar} size={34} />
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.light.placeholder}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={280}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={handleSubmitComment}
          />
          {commentText.trim().length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={handleSubmitComment}
            >
              <Feather name="send" size={16} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  commentsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
  },
  commentsTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noComments: {
    alignItems: "center",
    paddingTop: 48,
    gap: 10,
  },
  noCommentsText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.separator,
    backgroundColor: Colors.light.background,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
});
