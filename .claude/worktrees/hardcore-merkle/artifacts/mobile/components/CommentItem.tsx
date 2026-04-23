import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { TimeAgo } from "@/components/TimeAgo";
import Colors from "@/constants/colors";
import { Comment } from "@/context/AppContext";

type Props = {
  comment: Comment;
};

export function CommentItem({ comment }: Props) {
  return (
    <View style={styles.container}>
      <Avatar uri={comment.user.avatar} size={36} />
      <View style={styles.bubble}>
        <View style={styles.header}>
          <Text style={styles.name}>{comment.user.name}</Text>
          <TimeAgo date={comment.createdAt} style={styles.time} />
        </View>
        <Text style={styles.content}>{comment.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubble: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    padding: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  time: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  content: {
    fontSize: 14,
    color: Colors.light.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
