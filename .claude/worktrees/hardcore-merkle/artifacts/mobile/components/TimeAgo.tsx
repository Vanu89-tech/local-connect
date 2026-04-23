import React from "react";
import { Text, TextStyle } from "react-native";

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

type Props = {
  date: string;
  style?: TextStyle;
};

export function TimeAgo({ date, style }: Props) {
  return <Text style={style}>{timeAgo(date)}</Text>;
}
