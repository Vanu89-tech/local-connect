import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { ChatMessage, Group, Party, useApp } from "@/context/AppContext";

const TAB_BAR_H = 84;
const EMOJI_PANEL_H = 280;
const QUICK_REACT = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const isNeon = Colors.activeStyle.id === "neon";
const partySurf = isNeon ? "rgba(255,43,214,0.18)" : Colors.light.backgroundTertiary;
const utilSurf  = isNeon ? "rgba(0,240,255,0.12)"  : Colors.light.backgroundTertiary;

// ── Emoji categories ──────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  { id:"smileys",  icon:"😊", label:"Smileys",  emojis:["😊","😂","🥰","😎","🤔","😅","🙏","😢","😠","🤣","😍","🥺","😮","😴","🤩","😤","🫶","🤗","😬","😇","😭","🤯","😱","🫠","😏","🤫","🫡","🥳","😜","🤪"] },
  { id:"gestures", icon:"👍", label:"Gesten",   emojis:["👍","👎","❤️","🔥","💯","✨","🎉","🙌","👏","🤝","💪","👀","💀","💫","⚡","🫂","🤌","✌️","👋","🤙","☝️","👆","🤞","🙊","🙈","💋","💔","❣️","💕","🫀"] },
  { id:"fun",      icon:"🎮", label:"Spaß",     emojis:["🎮","🎵","🎸","🎨","🎭","🏆","🎯","🚀","🌈","🎪","🎤","🎬","🎲","🎳","🎱","🎰","🎠","🎡","🎢","🎻","🥁","🎷","🎺","🎹","🎧","📸","💻","📱","🖥️","🎃"] },
  { id:"food",     icon:"🍕", label:"Essen",    emojis:["🍕","🍜","🍺","☕","🍔","🌮","🍣","🍦","🎂","🍰","🥐","🥗","🍱","🍛","🥩","🍗","🌯","🥙","🫔","🧆","🧇","🥞","🍩","🍪","🍫","🍭","🧃","🥤","🍹","🥂"] },
  { id:"nature",   icon:"🌸", label:"Natur",    emojis:["🌸","🌻","🍀","🌿","🌳","🦋","🐱","🐶","🦊","🌞","🌧️","❄️","🌺","🍂","🦁","🐼","🦄","🌴","🍄","🐸","🌊","🏔️","🌙","⭐","🌟","🌈","🍁","🌾","🎄","🌵"] },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ProfileChatThread = {
  type: "profile";
  id: string;
  name: string;
  subtitle: string;
  avatar: string;
  messages: ChatMessage[];
  username: string;
  status: string;
};

type ChatThread =
  | ProfileChatThread
  | { type: "party";   id: string; name: string; subtitle: string; icon: string;   messages: ChatMessage[]; party: Party }
  | { type: "group";   id: string; name: string; subtitle: string; icon: string;   messages: ChatMessage[]; group: Group };

type MsgReaction = { emoji: string; count: number; mine: boolean };
type ReplyTarget = { id: string; text: string; senderName: string };
type ExtMsg = ChatMessage & { replyTo?: ReplyTarget };

function toPartyThreads(parties: Party[]): ChatThread[] {
  return parties.map((p) => ({
    type: "party" as const, id: `party:${p.id}`, name: p.name,
    subtitle: `${p.members.length} Mitglieder · ${p.hostName}`, icon: "🎉", party: p,
    messages: [],
  }));
}

function toGroupThreads(groups: Group[]): ChatThread[] {
  return groups.map((g) => ({
    type: "group" as const, id: `group:${g.id}`, name: g.name,
    subtitle: `${g.members.length} Mitglieder · ${g.ownerName}`, icon: "👥", group: g,
    messages: [],
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function getLastMsg(thread: ChatThread, local: Record<string,ChatMessage[]>): ChatMessage|null {
  const all = [...thread.messages, ...(local[thread.id]??[])];
  return all.length ? all[all.length-1] : null;
}

function getSenderName(senderId: string, thread: ChatThread): string {
  if (thread.type === "party") {
    if (senderId === thread.party.hostId) return thread.party.hostName;
    return thread.party.members.find((m) => m.id === senderId)?.name ?? senderId;
  }
  if (thread.type === "group") {
    if (senderId === thread.group.ownerId) return thread.group.ownerName;
    return thread.group.members.find((m) => m.id === senderId)?.name ?? senderId;
  }
  return thread.name;
}

function formatTime(time?: string): string {
  return time ?? "";
}

// ── EmojiPicker ───────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const emojis = EMOJI_CATEGORIES.find((c) => c.id === cat)?.emojis ?? [];
  return (
    <View style={ep.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ep.catBar} contentContainerStyle={ep.catBarContent}>
        {EMOJI_CATEGORIES.map((c) => (
          <Pressable key={c.id} onPress={() => setCat(c.id)} style={[ep.catBtn, cat === c.id && ep.catBtnOn]}>
            <Text style={ep.catIcon}>{c.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={ep.grid} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        {emojis.map((e) => (
          <Pressable key={e} onPress={() => onSelect(e)} style={({ pressed }) => [ep.cell, pressed && ep.cellOn]}>
            <Text style={ep.emoji}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const ep = StyleSheet.create({
  panel: { height: EMOJI_PANEL_H, backgroundColor: Colors.light.backgroundTertiary, borderTopWidth: 2, borderTopColor: Colors.light.text },
  catBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.light.separator },
  catBarContent: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  catBtn: { width: 42, height: 42, borderRadius: Colors.shape.radiusSm, alignItems:"center", justifyContent:"center" },
  catBtnOn: { backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1.5, borderColor: Colors.light.tint },
  catIcon: { fontSize: 22 },
  grid: { flexDirection:"row", flexWrap:"wrap", paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  cell: { width: 46, height: 46, alignItems:"center", justifyContent:"center", borderRadius: Colors.shape.radiusSm },
  cellOn: { backgroundColor: Colors.light.backgroundSecondary },
  emoji: { fontSize: 26 },
});

// ── TypingDots ────────────────────────────────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(160, [d1, d2, d3].map((d) =>
        Animated.sequence([
          Animated.timing(d, { toValue:1, duration:280, useNativeDriver:true }),
          Animated.timing(d, { toValue:0, duration:280, useNativeDriver:true }),
        ])
      ))
    );
    loop.start();
    return () => loop.stop();
  }, [d1, d2, d3]);
  return (
    <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
      {[d1, d2, d3].map((d, i) => (
        <Animated.View key={i} style={{
          width:7, height:7, borderRadius:3.5,
          backgroundColor: Colors.light.textSecondary,
          opacity: d.interpolate({ inputRange:[0,1], outputRange:[0.3,1] }),
          transform:[{ translateY: d.interpolate({ inputRange:[0,1], outputRange:[0,-4] }) }],
        }} />
      ))}
    </View>
  );
}

// ── MessageRow (swipe-to-reply + long-press) ──────────────────────────────────
type MsgRowProps = {
  message: ExtMsg;
  mine: boolean;
  isGroup: boolean;
  senderName: string;
  reactions: MsgReaction[];
  isStarred: boolean;
  onReply: (m: ExtMsg) => void;
  onLongPress: (m: ExtMsg) => void;
};

function MessageRow({ message, mine, isGroup, senderName, reactions, isStarred, onReply, onLongPress }: MsgRowProps) {
  const swipeX      = useRef(new Animated.Value(0)).current;
  const cbRef       = useRef({ onReply, onLongPress, message });
  const thresholdHit = useRef(false);
  cbRef.current = { onReply, onLongPress, message };

  // Resistance curve: full movement up to 36px, then 40% beyond
  const applyResistance = (raw: number) => {
    const abs = Math.abs(raw);
    const clamped = abs > 36 ? 36 + (abs - 36) * 0.4 : abs;
    return mine ? -clamped : clamped;
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => {
      // Respond quickly: 6px horizontal, lenient angle (1.3x) so diagonal swipes still work
      const isHoriz = Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.3;
      return isHoriz && (mine ? gs.dx < -4 : gs.dx > 4);
    },
    onPanResponderGrant: () => {
      thresholdHit.current = false;
    },
    onPanResponderMove: (_, gs) => {
      const raw = mine ? Math.max(-90, Math.min(0, gs.dx)) : Math.min(90, Math.max(0, gs.dx));
      swipeX.setValue(applyResistance(raw));

      // Haptic pre-trigger at threshold so the user feels it before lifting finger
      const dist = Math.abs(raw);
      if (!thresholdHit.current && dist > 44) {
        thresholdHit.current = true;
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (thresholdHit.current && dist <= 44) {
        thresholdHit.current = false; // pulled back under threshold – reset
      }
    },
    onPanResponderRelease: (_, gs) => {
      const didTrigger = mine ? gs.dx < -44 : gs.dx > 44;
      if (didTrigger) {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        cbRef.current.onReply(cbRef.current.message);
      }
      // Bounceback: more spring when threshold was crossed for a satisfying snap
      Animated.spring(swipeX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: didTrigger ? 10 : 4,
        speed: didTrigger ? 14 : 20,
      }).start();
      thresholdHit.current = false;
    },
    onPanResponderTerminate: () => {
      thresholdHit.current = false;
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 20 }).start();
    },
  })).current;

  const statusIcon = !mine ? "" :
    message.status === "read"      ? "✓✓" :
    message.status === "delivered" ? "✓✓" :
    message.status === "sent"      ? "✓"  :
    message.status === "sending"   ? "◷"  :
    message.status === "failed"    ? "✕"  : "";

  return (
    <View>
      <Animated.View style={{ transform:[{ translateX: swipeX }] }} {...pan.panHandlers}>
        <Pressable
          onLongPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onLongPress(message);
          }}
          delayLongPress={420}
        >
          <View style={[st.msgRow, mine ? st.msgRowMine : st.msgRowTheirs]}>
            <View style={st.bubbleCol}>
              {/* Group sender name */}
              {isGroup && !mine && (
                <Text style={st.senderName}>{senderName}</Text>
              )}
              <View style={[st.bubble, mine ? st.bubbleMine : st.bubbleTheirs, message.status === "failed" && st.bubbleFailed]}>
                {/* Reply preview */}
                {message.replyTo && (
                  <View style={[st.replyPreview, mine ? st.replyPreviewMine : st.replyPreviewTheirs]}>
                    <Text style={st.replyPreviewName} numberOfLines={1}>{message.replyTo.senderName}</Text>
                    <Text style={[st.replyPreviewText, mine ? st.replyPreviewTextMine : st.replyPreviewTextTheirs]} numberOfLines={2}>
                      {message.replyTo.text}
                    </Text>
                  </View>
                )}
                {/* Image */}
                {message.imageUri ? <Image source={{ uri: message.imageUri }} style={st.msgImg} contentFit="cover" /> : null}
                {/* Text */}
                {message.text ? (
                  <Text style={[st.msgText, mine ? st.msgTextMine : st.msgTextTheirs]}>{message.text}</Text>
                ) : null}
                {/* Footer */}
                <View style={st.msgFooter}>
                  {isStarred ? <Text style={{ fontSize:10, marginRight:2 }}>⭐</Text> : null}
                  <Text style={[st.msgTime, mine ? st.msgTimeMine : st.msgTimeTheirs]}>{message.time}</Text>
                  {mine && statusIcon ? (
                    <Text style={[st.msgStatus, message.status === "read" ? { color: Colors.light.tintBlue } : { color:"rgba(255,255,255,0.58)" }]}>
                      {statusIcon}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Reactions */}
      {reactions.length > 0 && (
        <View style={[st.reactRow, mine ? st.reactRowMine : st.reactRowTheirs]}>
          {reactions.map((r) => (
            <View key={r.emoji} style={[st.reactChip, r.mine && st.reactChipMine]}>
              <Text style={st.reactEmoji}>{r.emoji}</Text>
              {r.count > 1 && <Text style={st.reactCount}>{r.count}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { currentUser, parties, groups, acceptedFriends, mapFriends, localMessages, addLocalMessage, markThreadRead } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // View state
  const [viewMode, setViewMode] = useState<"list"|"chat">("list");
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ExtMsg|null>(null);
  const [actionTarget, setActionTarget] = useState<ExtMsg|null>(null);
  const [localReactions, setLocalReactions] = useState<Record<string,MsgReaction[]>>({});
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [pinnedByThread, setPinnedByThread] = useState<Record<string,string>>({});
  const [dismissedPins, setDismissedPins] = useState<Set<string>>(new Set());
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string,number>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef  = useRef<TextInput>(null);

  // Build threads
  const partyThreads  = useMemo(() => toPartyThreads(parties), [parties]);
  const groupThreads  = useMemo(() => toGroupThreads(groups), [groups]);
  const profileThreads = useMemo<ProfileChatThread[]>(
    () => acceptedFriends.map((friend) => ({
      type: "profile" as const,
      id: friend.id,
      name: friend.name,
      subtitle: friend.location || "Freund",
      avatar: friend.avatar,
      username: friend.username,
      status: friend.location || "Freund",
      messages: [],
    })),
    [acceptedFriends],
  );
  const mapFriendThreads = useMemo<ChatThread[]>(
    () => mapFriends.map((f) => ({
      type:"profile" as const, id:f.id, name:f.name, subtitle:f.activity,
      avatar:f.avatarUrl, username:f.id, status:f.activity,
      messages:[],
    })),
    [mapFriends],
  );

  const threads = useMemo(() => {
    const pids = new Set(profileThreads.map((t) => t.id));
    return [...partyThreads, ...groupThreads, ...mapFriendThreads.filter((t) => !pids.has(t.id)), ...profileThreads];
  }, [groupThreads, mapFriendThreads, partyThreads, profileThreads]);

  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
  const selectedThread = useMemo(() => threads.find((t) => t.id === selectedId) ?? threads[0], [selectedId, threads]);

  // Initialise unread counts once threads are known
  useEffect(() => {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      threads.forEach((t, i) => {
        if (!(t.id in next)) next[t.id] = 0;
      });
      return next;
    });
  }, [threads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectedId valid
  useEffect(() => {
    if (!threads.length) return;
    setSelectedId((cur) => (threads.some((t) => t.id === cur) ? cur : threads[0].id));
  }, [threads]);

  // Mark read + typing sim when thread changes
  useEffect(() => {
    if (!selectedThread) return;
    void markThreadRead(selectedThread.id);
    setUnreadCounts((p) => ({ ...p, [selectedThread.id]: 0 }));
    if (Math.random() > 0.45) return;
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setTypingIds((s) => new Set([...s, selectedThread.id]));
      t2 = setTimeout(() => {
        setTypingIds((s) => { const n = new Set(s); n.delete(selectedThread.id); return n; });
      }, 1800 + Math.random() * 2400);
    }, 900 + Math.random() * 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [selectedThread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allMessages = useMemo(() => {
    const msgs: ExtMsg[] = [
      ...(selectedThread?.messages ?? []) as ExtMsg[],
      ...(localMessages[selectedThread?.id ?? ""] ?? []) as ExtMsg[],
    ];
    const byKey = new Map<string, ExtMsg>();
    msgs.forEach((m) => byKey.set(m.clientMessageId ?? m.id, m));
    return Array.from(byKey.values()).sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });
  }, [selectedThread, localMessages]);

  const pinnedMessageId  = selectedThread ? (pinnedByThread[selectedThread.id] ?? null) : null;
  const pinnedMessage    = pinnedMessageId ? allMessages.find((m) => m.id === pinnedMessageId) ?? null : null;
  const showPinnedBanner = !!pinnedMessage && !dismissedPins.has(selectedThread?.id ?? "");
  const isGroupThread    = selectedThread?.type === "party" || selectedThread?.type === "group";
  const isTyping         = !!selectedThread && typingIds.has(selectedThread.id);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const addMessage = useCallback((msg: ExtMsg) => {
    if (!selectedThread) return;
    addLocalMessage(selectedThread.id, msg as ChatMessage);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [selectedThread, addLocalMessage]);

  const handleSend = useCallback(() => {
    if (!draft.trim() || !selectedThread) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = `client-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    addMessage({
      id, clientMessageId: id, senderId: currentUser.id,
      text: draft.trim(), time: nowTime(), createdAt: new Date().toISOString(),
      ...(replyingTo ? { replyTo: { id: replyingTo.id, text: replyingTo.text || "📷 Foto", senderName: replyingTo.senderId === currentUser.id ? "Du" : getSenderName(replyingTo.senderId, selectedThread) } } : {}),
    } as ExtMsg);
    setDraft("");
    setReplyingTo(null);
  }, [addMessage, currentUser.id, draft, replyingTo, selectedThread]);

  const openThread = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedId(id);
    setEmojiOpen(false);
    setReplyingTo(null);
    setViewMode("chat");
  }, []);

  const goBack = useCallback(() => {
    setViewMode("list");
    setEmojiOpen(false);
    setReplyingTo(null);
  }, []);

  const handleReply = useCallback((msg: ExtMsg) => {
    setReplyingTo(msg);
    setEmojiOpen(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const handleLongPress = useCallback((msg: ExtMsg) => {
    setActionTarget(msg);
  }, []);

  const handleReact = useCallback((emoji: string) => {
    if (!actionTarget) return;
    const msgId = actionTarget.id;
    setLocalReactions((prev) => {
      const cur = [...(prev[msgId] ?? [])];
      const idx = cur.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        if (cur[idx].mine) {
          const updated = { ...cur[idx], count: cur[idx].count - 1, mine: false };
          return { ...prev, [msgId]: updated.count <= 0 ? cur.filter((_, i) => i !== idx) : cur.map((r, i) => i === idx ? updated : r) };
        }
        return { ...prev, [msgId]: cur.map((r, i) => i === idx ? { ...r, count: r.count + 1, mine: true } : r) };
      }
      return { ...prev, [msgId]: [...cur, { emoji, count: 1, mine: true }] };
    });
    setActionTarget(null);
  }, [actionTarget]);

  const handleToggleStar = useCallback((msgId: string) => {
    setStarredIds((s) => { const n = new Set(s); n.has(msgId) ? n.delete(msgId) : n.add(msgId); return n; });
    setActionTarget(null);
  }, []);

  const handlePin = useCallback((msgId: string) => {
    if (!selectedThread) return;
    setPinnedByThread((p) => ({ ...p, [selectedThread.id]: p[selectedThread.id] === msgId ? "" : msgId }));
    setDismissedPins((s) => { const n = new Set(s); n.delete(selectedThread.id); return n; });
    setActionTarget(null);
  }, [selectedThread]);

  const handlePickImage = useCallback(async () => {
    setMediaModalOpen(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:"images", quality:0.85, allowsEditing:true });
    if (!res.canceled && res.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const id = `client-img-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      addMessage({ id, clientMessageId:id, senderId:currentUser.id, text:"", time:nowTime(), createdAt:new Date().toISOString(), imageUri:res.assets[0].uri } as ExtMsg);
    }
  }, [addMessage, currentUser.id]);

  const handleTakePhoto = useCallback(async () => {
    setMediaModalOpen(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchCameraAsync({ quality:0.85, allowsEditing:true });
    if (!res.canceled && res.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const id = `client-cam-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      addMessage({ id, clientMessageId:id, senderId:currentUser.id, text:"", time:nowTime(), createdAt:new Date().toISOString(), imageUri:res.assets[0].uri } as ExtMsg);
    }
  }, [addMessage, currentUser.id]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profileThreads;
    return profileThreads.filter((c) => `${c.name} ${c.username} ${c.status}`.toLowerCase().includes(q));
  }, [profileThreads, searchQuery]);

  // ── Render: Conversation List ────────────────────────────────────────────────
  const renderList = () => (
    <View style={{ flex:1 }}>
      {/* Header */}
      <View style={[st.listHeader, { paddingTop: topPad + 8 }]}>
        <Text style={st.listTitle}>Nachrichten</Text>
        <View style={{ flexDirection:"row", gap:8 }}>
          <Pressable style={({ pressed }) => [st.hBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => router.push("/presence-choice")}>
            <Feather name="home" size={21} color={Colors.light.text} />
          </Pressable>
          <Pressable style={({ pressed }) => [st.hBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setSearchOpen(true); setEmojiOpen(false); }}>
            <Feather name="search" size={20} color={Colors.light.text} />
          </Pressable>
        </View>
      </View>

      {/* Thread rows */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_H + (insets.bottom || 10) }}>
        {threads.map((thread) => {
          const lastMsg  = getLastMsg(thread, localMessages);
          const lastText = lastMsg?.imageUri ? "📷 Foto" : (lastMsg?.text ?? "");
          const unread   = unreadCounts[thread.id] ?? 0;
          const typing   = typingIds.has(thread.id);
          const isSelected = thread.id === selectedThread?.id;
          return (
            <Pressable
              key={thread.id}
              style={({ pressed }) => [st.threadRow, isSelected && st.threadRowSelected, { opacity: pressed ? 0.82 : 1 }]}
              onPress={() => openThread(thread.id)}
            >
              {/* Avatar */}
              <View style={st.threadAvatarWrap}>
                {thread.type !== "profile"
                  ? <View style={[st.threadAvatar, st.threadAvatarGroup]}><Text style={st.threadIcon}>{thread.icon}</Text></View>
                  : <Image source={{ uri: (thread as {avatar:string}).avatar }} style={st.threadAvatar} contentFit="cover" />}
                <View style={[st.threadOnlineDot, thread.type !== "profile" && st.threadPartyDot]} />
              </View>

              {/* Middle */}
              <View style={st.threadMid}>
                <Text style={st.threadName} numberOfLines={1}>{thread.name}</Text>
                {typing ? (
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:3 }}>
                    <TypingDots />
                    <Text style={[st.threadLast, { color: Colors.light.tint, fontStyle:"italic" }]}>tippt...</Text>
                  </View>
                ) : (
                  <Text style={[st.threadLast, unread > 0 && st.threadLastBold]} numberOfLines={1}>{lastText}</Text>
                )}
              </View>

              {/* Right */}
              <View style={st.threadRight}>
                <Text style={[st.threadTime, unread > 0 && { color: Colors.light.tint }]}>{formatTime(lastMsg?.time)}</Text>
                {unread > 0 && (
                  <View style={st.badge}>
                    <Text style={st.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Render: Chat view ────────────────────────────────────────────────────────
  const renderChat = () => (
    <KeyboardAvoidingView
      style={{ flex:1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 86 : 0}
    >
      {/* Chat header */}
      <View style={[st.chatHeader, { paddingTop: topPad + 4 }]}>
        <Pressable style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={goBack}>
          <Feather name="chevron-left" size={26} color={Colors.light.text} />
        </Pressable>
        {selectedThread?.type !== "profile"
          ? <View style={[st.chatAvatar, st.chatAvatarGroup]}><Text style={st.chatGroupIcon}>{selectedThread?.icon ?? "👥"}</Text></View>
          : <Image source={{ uri: (selectedThread as {avatar:string}).avatar }} style={st.chatAvatar} contentFit="cover" />}
        <View style={st.chatHeaderMid}>
          <Text style={st.chatName} numberOfLines={1}>{selectedThread?.name}</Text>
          {isTyping ? (
            <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
              <TypingDots />
              <Text style={[st.chatStatus, { color: Colors.light.tint, fontStyle:"italic" }]}>tippt...</Text>
            </View>
          ) : (
            <Text style={st.chatStatus} numberOfLines={1}>{selectedThread?.subtitle}</Text>
          )}
        </View>
        <View style={{ flexDirection:"row", gap:6 }}>
          <Pressable style={({ pressed }) => [st.hBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="phone" size={19} color={Colors.light.textSecondary} />
          </Pressable>
          <Pressable style={({ pressed }) => [st.hBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="video" size={19} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Pinned message banner */}
      {showPinnedBanner && pinnedMessage && (
        <Pressable style={st.pinnedBanner} onPress={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}>
          <Feather name="bookmark" size={14} color={Colors.light.tint} style={{ marginRight:6 }} />
          <View style={{ flex:1 }}>
            <Text style={st.pinnedLabel}>Gepinnte Nachricht</Text>
            <Text style={st.pinnedText} numberOfLines={1}>{pinnedMessage.text || "📷 Foto"}</Text>
          </View>
          <Pressable onPress={() => setDismissedPins((s) => new Set([...s, selectedThread?.id ?? ""]))} hitSlop={8}>
            <Feather name="x" size={16} color={Colors.light.textSecondary} />
          </Pressable>
        </Pressable>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={st.msgs}
        contentContainerStyle={st.msgsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => setEmojiOpen(false)}
        onScrollBeginDrag={() => setEmojiOpen(false)}
      >
        {allMessages.map((msg) => {
          const mine = msg.senderId === currentUser.id || msg.senderId === "me";
          const name = !mine && selectedThread ? getSenderName(msg.senderId, selectedThread) : "Du";
          const reactions = localReactions[msg.id] ?? [];
          return (
            <MessageRow
              key={msg.id}
              message={msg}
              mine={mine}
              isGroup={isGroupThread}
              senderName={name}
              reactions={reactions}
              isStarred={starredIds.has(msg.id)}
              onReply={handleReply}
              onLongPress={handleLongPress}
            />
          );
        })}

        {/* Typing bubble */}
        {isTyping && (
          <View style={[st.msgRow, st.msgRowTheirs]}>
            <View style={[st.bubble, st.bubbleTheirs, { paddingVertical:12, paddingHorizontal:14 }]}>
              <TypingDots />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Reply strip */}
      {replyingTo && (
        <View style={st.replyStrip}>
          <View style={st.replyStripBar} />
          <View style={{ flex:1 }}>
            <Text style={st.replyStripName}>{replyingTo.senderId === currentUser.id ? "Du" : getSenderName(replyingTo.senderId, selectedThread!)}</Text>
            <Text style={st.replyStripText} numberOfLines={1}>{replyingTo.text || "📷 Foto"}</Text>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={10}>
            <Feather name="x" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Composer */}
      <View style={[st.composer, { paddingBottom: emojiOpen ? 8 : TAB_BAR_H + Math.max(insets.bottom, 10) }]}>
        <View style={st.composerRow}>
          <Pressable style={({ pressed }) => [st.mediaBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setMediaModalOpen(true); setEmojiOpen(false); }}>
            <Feather name="image" size={21} color={Colors.light.tintBlue} />
          </Pressable>
          <View style={st.inputWrap}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onFocus={() => setEmojiOpen(false)}
              placeholder={`Nachricht an ${selectedThread?.name ?? ""}`}
              placeholderTextColor={Colors.light.textTertiary}
              style={st.input}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
            />
            <Pressable style={({ pressed }) => [st.emojiToggle, emojiOpen && st.emojiToggleOn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { if (!emojiOpen) inputRef.current?.blur(); setEmojiOpen((o) => !o); }}>
              <Text style={{ fontSize:22 }}>{emojiOpen ? "⌨️" : "😊"}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [st.sendBtn, { opacity: pressed ? 0.82 : 1 }]} onPress={handleSend}>
              <Feather name="send" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Emoji panel */}
      {emojiOpen && (
        <View style={{ paddingBottom: TAB_BAR_H + Math.max(insets.bottom, 10) }}>
          <EmojiPicker onSelect={(e) => setDraft((d) => d + e)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );

  // ── Root render ──────────────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      {viewMode === "list" ? renderList() : renderChat()}

      {/* Message action modal */}
      <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <Pressable style={st.actionOverlay} onPress={() => setActionTarget(null)}>
          <Pressable style={st.actionSheet} onPress={(e) => e.stopPropagation()}>
            {/* Quick reactions */}
            <View style={st.quickReactRow}>
              {QUICK_REACT.map((emoji) => {
                const reacted = localReactions[actionTarget?.id ?? ""]?.find((r) => r.emoji === emoji && r.mine);
                return (
                  <Pressable key={emoji} onPress={() => handleReact(emoji)} style={({ pressed }) => [st.quickReactBtn, reacted && st.quickReactBtnOn, { opacity: pressed ? 0.75 : 1 }]}>
                    <Text style={st.quickReactEmoji}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={st.actionDivider} />
            {/* Actions */}
            {([
              { icon:"corner-up-left", label:"Antworten", fn: () => { handleReply(actionTarget!); setActionTarget(null); } },
              { icon: starredIds.has(actionTarget?.id ?? "") ? "star" : "star", label: starredIds.has(actionTarget?.id ?? "") ? "Stern entfernen" : "Mit Stern markieren", fn: () => handleToggleStar(actionTarget?.id ?? "") },
              { icon:"bookmark", label: pinnedByThread[selectedThread?.id ?? ""] === actionTarget?.id ? "Losgelöst" : "Pinnen", fn: () => handlePin(actionTarget?.id ?? "") },
            ] as { icon: React.ComponentProps<typeof Feather>["name"]; label: string; fn: () => void }[]).map((item) => (
              <Pressable key={item.label} style={({ pressed }) => [st.actionBtn, { opacity: pressed ? 0.75 : 1 }]} onPress={item.fn}>
                <Feather name={item.icon} size={19} color={Colors.light.text} />
                <Text style={st.actionBtnLabel}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [st.actionCancelBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setActionTarget(null)}>
              <Text style={st.actionCancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Media picker modal */}
      <Modal visible={mediaModalOpen} transparent animationType="slide" onRequestClose={() => setMediaModalOpen(false)}>
        <Pressable style={st.mediaOverlay} onPress={() => setMediaModalOpen(false)}>
          <Pressable style={[st.mediaSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Foto senden</Text>
            <Pressable style={({ pressed }) => [st.mediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handleTakePhoto}>
              <View style={[st.mediaOptionIcon, { backgroundColor: Colors.light.tint }]}><Feather name="camera" size={22} color="#fff" /></View>
              <View><Text style={st.mediaOptionLabel}>Foto aufnehmen</Text><Text style={st.mediaOptionSub}>Kamera öffnen</Text></View>
            </Pressable>
            <Pressable style={({ pressed }) => [st.mediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handlePickImage}>
              <View style={[st.mediaOptionIcon, { backgroundColor: Colors.light.tintBlue }]}><Feather name="image" size={22} color="#fff" /></View>
              <View><Text style={st.mediaOptionLabel}>Aus Galerie wählen</Text><Text style={st.mediaOptionSub}>Foto aus der Bibliothek</Text></View>
            </Pressable>
            <Pressable style={({ pressed }) => [st.mediaCancelBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setMediaModalOpen(false)}>
              <Text style={st.mediaCancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search modal */}
      <Modal visible={searchOpen} animationType="fade" transparent onRequestClose={() => { setSearchOpen(false); setSearchQuery(""); }}>
        <Pressable style={st.searchOverlay} onPress={() => { setSearchOpen(false); setSearchQuery(""); }}>
          <Pressable style={st.searchPanel} onPress={(e) => e.stopPropagation()}>
            <View style={st.searchPanelHeader}>
              <Text style={st.searchTitle}>Profile suchen</Text>
              <Pressable style={({ pressed }) => [st.hBtn, { opacity: pressed ? 0.72 : 1 }]} onPress={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <Feather name="x" size={20} color={Colors.light.text} />
              </Pressable>
            </View>
            <View style={st.searchInputWrap}>
              <Feather name="search" size={18} color={Colors.light.textSecondary} />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} autoFocus placeholder="Name oder Nutzername" placeholderTextColor={Colors.light.textTertiary} style={st.searchInput} />
            </View>
            <ScrollView style={{ maxHeight:360 }} contentContainerStyle={st.searchResultsContent}>
              {searchResults.map((c) => (
                <Pressable key={c.id} style={({ pressed }) => [st.searchResult, { opacity: pressed ? 0.78 : 1 }]} onPress={() => { openThread(c.id); setSearchOpen(false); setSearchQuery(""); }}>
                  <Image source={{ uri: c.avatar }} style={st.searchResultAvatar} contentFit="cover" />
                  <View style={{ flex:1, minWidth:0 }}>
                    <Text style={st.searchResultName}>{c.name}</Text>
                    <Text style={st.searchResultMeta} numberOfLines={1}>@{c.username} · {c.status}</Text>
                  </View>
                  <Feather name="message-circle" size={19} color={Colors.light.tint} />
                </Pressable>
              ))}
              {!searchResults.length && (
                <View style={{ alignItems:"center", paddingVertical:26, gap:4 }}>
                  <Text style={{ fontSize:17, fontFamily:"Inter_700Bold", color:Colors.light.text }}>Nichts gefunden</Text>
                  <Text style={{ fontSize:13, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary }}>Versuch einen anderen Namen.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex:1, backgroundColor: Colors.light.background },

  // List header
  listHeader: {
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:18, paddingBottom:14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
  },
  listTitle: { fontSize:26, fontFamily:"Inter_700Bold", color:Colors.light.text },

  // Thread rows (WhatsApp-style)
  threadRow: {
    flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
    backgroundColor: Colors.light.background, gap:12,
  },
  threadRowSelected: { backgroundColor: Colors.light.backgroundSecondary },
  threadAvatarWrap: { position:"relative" },
  threadAvatar: { width:54, height:54, borderRadius:27, backgroundColor:Colors.light.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator },
  threadAvatarGroup: { alignItems:"center", justifyContent:"center", backgroundColor: partySurf },
  threadIcon: { fontSize:26 },
  threadOnlineDot: { position:"absolute", right:1, bottom:1, width:14, height:14, borderRadius:7, backgroundColor:Colors.light.mint, borderWidth:2, borderColor:Colors.light.background },
  threadPartyDot: { backgroundColor: Colors.light.tint },
  threadMid: { flex:1, minWidth:0, gap:3 },
  threadName: { fontSize:16, fontFamily:"Inter_700Bold", color:Colors.light.text },
  threadLast: { fontSize:14, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary },
  threadLastBold: { fontFamily:"Inter_600SemiBold", color:Colors.light.text },
  threadRight: { alignItems:"flex-end", gap:6, minWidth:48 },
  threadTime: { fontSize:12, fontFamily:"Inter_400Regular", color:Colors.light.textTertiary },
  badge: { minWidth:22, height:22, borderRadius:11, backgroundColor:Colors.light.tint, alignItems:"center", justifyContent:"center", paddingHorizontal:4 },
  badgeText: { fontSize:12, fontFamily:"Inter_700Bold", color:"#fff" },

  // Common header button
  hBtn: {
    width:40, height:40, borderRadius:20,
    alignItems:"center", justifyContent:"center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator,
  },

  // Chat header
  chatHeader: {
    flexDirection:"row", alignItems:"center", paddingHorizontal:12, paddingBottom:12, gap:10,
    backgroundColor: Colors.light.backgroundSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
  },
  backBtn: { width:36, height:36, alignItems:"center", justifyContent:"center" },
  chatAvatar: { width:44, height:44, borderRadius:22, backgroundColor:Colors.light.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator },
  chatAvatarGroup: { alignItems:"center", justifyContent:"center", backgroundColor: partySurf },
  chatGroupIcon: { fontSize:22 },
  chatHeaderMid: { flex:1, minWidth:0 },
  chatName: { fontSize:16, fontFamily:"Inter_700Bold", color:Colors.light.text },
  chatStatus: { fontSize:12, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary, marginTop:1 },

  // Pinned banner
  pinnedBanner: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:14, paddingVertical:10,
    backgroundColor: Colors.light.backgroundTertiary,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
  },
  pinnedLabel: { fontSize:10, fontFamily:"Inter_700Bold", color:Colors.light.tint, textTransform:"uppercase", letterSpacing:0.5 },
  pinnedText: { fontSize:13, fontFamily:"Inter_400Regular", color:Colors.light.text, marginTop:1 },

  // Messages
  msgs: { flex:1 },
  msgsContent: { paddingHorizontal:14, paddingTop:14, paddingBottom:18, gap:6, backgroundColor:Colors.light.background },

  // Message row
  msgRow: { width:"100%", flexDirection:"row", marginBottom:2 },
  msgRowMine: { justifyContent:"flex-end" },
  msgRowTheirs: { justifyContent:"flex-start" },
  bubbleCol: { maxWidth:"80%", gap:2 },
  senderName: { fontSize:11, fontFamily:"Inter_700Bold", color:Colors.light.tint, marginLeft:4, marginBottom:1 },
  bubble: {
    borderRadius:18, paddingHorizontal:13, paddingVertical:9,
    shadowColor:Colors.shadow.color, shadowOffset:{ width:0, height:Colors.shadow.offsetY },
    shadowOpacity:0.16, shadowRadius:Colors.shadow.radius,
  },
  bubbleMine: { backgroundColor: Colors.light.tint },
  bubbleTheirs: { backgroundColor: Colors.light.tintBlue },
  bubbleFailed: { backgroundColor:"#FF375F", opacity:0.92 },
  replyPreview: { borderRadius:8, marginBottom:6, paddingHorizontal:9, paddingVertical:6, borderLeftWidth:3 },
  replyPreviewMine: { backgroundColor:"rgba(255,255,255,0.18)", borderLeftColor:"rgba(255,255,255,0.7)" },
  replyPreviewTheirs: { backgroundColor:"rgba(0,0,0,0.08)", borderLeftColor:Colors.light.tint },
  replyPreviewName: { fontSize:11, fontFamily:"Inter_700Bold", color:"rgba(255,255,255,0.85)", marginBottom:2 },
  replyPreviewText: { fontSize:12, fontFamily:"Inter_400Regular" },
  replyPreviewTextMine: { color:"rgba(255,255,255,0.75)" },
  replyPreviewTextTheirs: { color:Colors.light.textSecondary },
  msgImg: { width:200, height:160, borderRadius:10, marginBottom:4 },
  msgText: { fontSize:15, fontFamily:"Inter_400Regular", lineHeight:21 },
  msgTextMine: { color:"#FFFFFF" },
  msgTextTheirs: { color:"#000000" },
  msgFooter: { flexDirection:"row", alignItems:"center", justifyContent:"flex-end", marginTop:4, gap:3 },
  msgTime: { fontSize:10, fontFamily:"Inter_500Medium" },
  msgTimeMine: { color:"rgba(255,255,255,0.62)" },
  msgTimeTheirs: { color:"rgba(0,0,0,0.45)" },
  msgStatus: { fontSize:11, fontFamily:"Inter_600SemiBold" },


  // Reactions
  reactRow: { flexDirection:"row", flexWrap:"wrap", gap:4, marginBottom:4, marginTop:2 },
  reactRowMine: { justifyContent:"flex-end", paddingRight:6 },
  reactRowTheirs: { justifyContent:"flex-start", paddingLeft:6 },
  reactChip: {
    flexDirection:"row", alignItems:"center", gap:2,
    paddingHorizontal:7, paddingVertical:3, borderRadius:12,
    backgroundColor:Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator,
  },
  reactChipMine: { borderColor:Colors.light.tint, backgroundColor: Colors.light.tint + "18" },
  reactEmoji: { fontSize:14 },
  reactCount: { fontSize:11, fontFamily:"Inter_700Bold", color:Colors.light.textSecondary },

  // Reply strip
  replyStrip: {
    flexDirection:"row", alignItems:"center", gap:10,
    paddingHorizontal:14, paddingVertical:10,
    backgroundColor:Colors.light.backgroundSecondary,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor:Colors.light.tint,
  },
  replyStripBar: { width:3, height:"100%", borderRadius:2, backgroundColor:Colors.light.tint, alignSelf:"stretch" },
  replyStripName: { fontSize:12, fontFamily:"Inter_700Bold", color:Colors.light.tint },
  replyStripText: { fontSize:13, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary, marginTop:1 },

  // Composer
  composer: {
    paddingHorizontal:14, paddingTop:10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor:Colors.light.separator,
    backgroundColor:Colors.light.background,
  },
  composerRow: { flexDirection:"row", alignItems:"flex-end", gap:8, marginBottom:8 },
  mediaBtn: {
    width:42, height:42, borderRadius:21,
    alignItems:"center", justifyContent:"center",
    backgroundColor:Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator,
  },
  inputWrap: {
    flex:1, minHeight:48, borderRadius:24,
    backgroundColor:Colors.light.backgroundSecondary,
    flexDirection:"row", alignItems:"flex-end",
    paddingLeft:14, paddingRight:6, paddingVertical:4, gap:4,
    borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator,
  },
  input: { flex:1, minHeight:38, maxHeight:120, fontSize:15, fontFamily:"Inter_400Regular", color:Colors.light.text, paddingVertical:6 },
  emojiToggle: { width:36, height:36, borderRadius:10, alignItems:"center", justifyContent:"center", marginBottom:2 },
  emojiToggleOn: { backgroundColor:Colors.light.backgroundTertiary },
  sendBtn: { width:38, height:38, borderRadius:19, backgroundColor:Colors.light.tint, alignItems:"center", justifyContent:"center", marginBottom:2 },

  // Action modal
  actionOverlay: { flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.42)" },
  actionSheet: {
    backgroundColor:Colors.light.background,
    borderTopLeftRadius:22, borderTopRightRadius:22,
    paddingTop:14, paddingHorizontal:18, paddingBottom:32,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor:Colors.light.separator,
    gap:6,
  },
  quickReactRow: { flexDirection:"row", justifyContent:"space-around", paddingVertical:10 },
  quickReactBtn: { width:48, height:48, borderRadius:24, alignItems:"center", justifyContent:"center", backgroundColor:Colors.light.backgroundSecondary },
  quickReactBtnOn: { backgroundColor:Colors.light.tint + "28", borderWidth:1.5, borderColor:Colors.light.tint },
  quickReactEmoji: { fontSize:26 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor:Colors.light.separator, marginVertical:4 },
  actionBtn: {
    flexDirection:"row", alignItems:"center", gap:14,
    paddingVertical:14, paddingHorizontal:16, borderRadius:Colors.shape.radiusMd,
    backgroundColor:Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator,
  },
  actionBtnLabel: { fontSize:16, fontFamily:"Inter_500Medium", color:Colors.light.text },
  actionCancelBtn: { alignItems:"center", paddingVertical:14, marginTop:4 },
  actionCancelText: { fontSize:16, fontFamily:"Inter_500Medium", color:Colors.light.textSecondary },

  // Media modal
  mediaOverlay: { flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.45)" },
  mediaSheet: { backgroundColor:Colors.light.background, borderTopLeftRadius:20, borderTopRightRadius:20, paddingTop:12, paddingHorizontal:20, gap:12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor:Colors.light.separator },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:Colors.light.separator, alignSelf:"center", marginBottom:8 },
  sheetTitle: { fontSize:18, fontFamily:"Inter_700Bold", color:Colors.light.text, marginBottom:4 },
  mediaOption: { flexDirection:"row", alignItems:"center", gap:16, paddingVertical:14, paddingHorizontal:16, borderRadius:Colors.shape.radiusMd, backgroundColor:Colors.light.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator },
  mediaOptionIcon: { width:48, height:48, borderRadius:Colors.shape.radiusSm, alignItems:"center", justifyContent:"center" },
  mediaOptionLabel: { fontSize:16, fontFamily:"Inter_700Bold", color:Colors.light.text },
  mediaOptionSub: { fontSize:13, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary, marginTop:2 },
  mediaCancelBtn: { alignItems:"center", paddingVertical:14 },
  mediaCancelText: { fontSize:16, fontFamily:"Inter_500Medium", color:Colors.light.textSecondary },

  // Search modal
  searchOverlay: { flex:1, justifyContent:"center", paddingHorizontal:20, backgroundColor:"rgba(21,34,56,0.42)" },
  searchPanel: { maxHeight:"72%", borderRadius:Colors.shape.radiusLg, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator, backgroundColor:Colors.light.background, overflow:"hidden" },
  searchPanelHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor:Colors.light.separator, backgroundColor:Colors.light.backgroundTertiary },
  searchTitle: { fontSize:22, fontFamily:"Inter_700Bold", color:Colors.light.text },
  searchInputWrap: { minHeight:50, margin:14, paddingHorizontal:12, borderRadius:20, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator, backgroundColor:Colors.light.backgroundSecondary, flexDirection:"row", alignItems:"center", gap:8 },
  searchInput: { flex:1, minHeight:46, fontSize:16, fontFamily:"Inter_400Regular", color:Colors.light.text },
  searchResultsContent: { paddingHorizontal:14, paddingBottom:14, gap:10 },
  searchResult: { minHeight:68, borderRadius:Colors.shape.radiusMd, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator, backgroundColor:Colors.light.backgroundSecondary, flexDirection:"row", alignItems:"center", paddingHorizontal:10, gap:10 },
  searchResultAvatar: { width:46, height:46, borderRadius:23, borderWidth: StyleSheet.hairlineWidth, borderColor:Colors.light.separator, backgroundColor:Colors.light.backgroundSecondary },
  searchResultName: { fontSize:16, fontFamily:"Inter_700Bold", color:Colors.light.text },
  searchResultMeta: { marginTop:2, fontSize:12, fontFamily:"Inter_400Regular", color:Colors.light.textSecondary },
});
