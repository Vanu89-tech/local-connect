import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { ChatMessage, Group, Party, User, useApp } from "@/context/AppContext";

const TAB_BAR_OVERLAY_HEIGHT = 84;
const EMOJI_PANEL_HEIGHT = 280;

const isNeonMessagesStyle = Colors.activeStyle.id === "neon";
const partyThreadSurface = isNeonMessagesStyle
  ? "rgba(255,43,214,0.18)"
  : Colors.light.backgroundTertiary;
const utilityButtonSurface = isNeonMessagesStyle
  ? "rgba(0,240,255,0.12)"
  : Colors.light.backgroundTertiary;

// ── Emoji data ──────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    id: "smileys", icon: "😊", label: "Smileys",
    emojis: ["😊","😂","🥰","😎","🤔","😅","🙏","😢","😠","🤣","😍","🥺","😮","😴","🤩","😤","🫶","🤗","😬","😇","😭","🤯","😱","🫠","😏","🤫","🫡","🥳","😜","🤪"],
  },
  {
    id: "gestures", icon: "👍", label: "Gesten",
    emojis: ["👍","👎","❤️","🔥","💯","✨","🎉","🙌","👏","🤝","💪","👀","💀","💫","⚡","🫂","🤌","✌️","👋","🤙","☝️","👆","🤞","🙊","🙈","💋","💔","❣️","💕","🫀"],
  },
  {
    id: "fun", icon: "🎮", label: "Spaß",
    emojis: ["🎮","🎵","🎸","🎨","🎭","🏆","🎯","🚀","🌈","🎪","🎤","🎬","🎲","🎳","🎱","🎰","🎠","🎡","🎢","🎻","🥁","🎷","🎺","🎹","🎧","📸","💻","📱","🖥️","🎃"],
  },
  {
    id: "food", icon: "🍕", label: "Essen",
    emojis: ["🍕","🍜","🍺","☕","🍔","🌮","🍣","🍦","🎂","🍰","🥐","🥗","🍱","🍛","🥩","🍗","🌯","🥙","🫔","🧆","🧇","🥞","🍩","🍪","🍫","🍭","🧃","🥤","🍹","🥂"],
  },
  {
    id: "nature", icon: "🌸", label: "Natur",
    emojis: ["🌸","🌻","🍀","🌿","🌳","🦋","🐱","🐶","🦊","🌞","🌧️","❄️","🌺","🍂","🦁","🐼","🦄","🌴","🍄","🐸","🌊","🏔️","🌙","⭐","🌟","🌈","🍁","🌾","🎄","🌵"],
  },
];

// ── Types ───────────────────────────────────────────────────────────────────

type ChatContact = User & {
  status: string;
  messages: ChatMessage[];
};

type ChatThread =
  | {
      type: "profile";
      id: string;
      name: string;
      subtitle: string;
      avatar: string;
      messages: ChatMessage[];
      username: string;
      status: string;
    }
  | {
      type: "party";
      id: string;
      name: string;
      subtitle: string;
      icon: string;
      messages: ChatMessage[];
      party: Party;
    }
  | {
      type: "group";
      id: string;
      name: string;
      subtitle: string;
      icon: string;
      messages: ChatMessage[];
      group: Group;
    };

// ── Demo data ────────────────────────────────────────────────────────────────
const DEMO_PARTY: Party = {
  id: "demo-party-griesle",
  name: "Party im Griesle",
  lat: 37.787,
  lng: -122.407,
  hostId: "maya",
  hostName: "Maya",
  members: [
    { id: "luca", name: "Luca", lat: 37.7871, lng: -122.4071 },
    { id: "priya", name: "Priya", lat: 37.7869, lng: -122.4072 },
    { id: "sam", name: "Sam", lat: 37.7872, lng: -122.4069 },
  ],
  createdAt: new Date().toISOString(),
};

const FALLBACK_CONTACTS: ChatContact[] = [
  {
    id: "maya", name: "Maya", username: "maya",
    avatar: "https://i.pravatar.cc/150?img=47", bio: "Coffee lover",
    location: "Nearby", followersCount: 0, followingCount: 0, postsCount: 0,
    status: "Sucht Kaffee in der Nähe",
    messages: [
      { id: "maya-1", senderId: "maya", text: "Hey, bist du später noch in der Gegend?", time: "12:34" },
      { id: "maya-2", senderId: "me", text: "Ja, wahrscheinlich beim Park. Was geht?", time: "12:36" },
      { id: "maya-3", senderId: "maya", text: "Ich wollte gleich einen kleinen Spaziergang machen.", time: "12:39" },
    ],
  },
  {
    id: "luca", name: "Luca", username: "luca",
    avatar: "https://i.pravatar.cc/150?img=12", bio: "Street photos",
    location: "Nearby", followersCount: 0, followingCount: 0, postsCount: 0,
    status: "Fotografiert gerade draußen",
    messages: [
      { id: "luca-1", senderId: "luca", text: "Der Sonnenuntergang sieht heute wild aus.", time: "18:08" },
      { id: "luca-2", senderId: "me", text: "Schick mal den Spot.", time: "18:10" },
      { id: "luca-3", senderId: "luca", text: "Bin beim kleinen Platz neben der Haltestelle.", time: "18:11" },
    ],
  },
  {
    id: "priya", name: "Priya", username: "priya",
    avatar: "https://i.pravatar.cc/150?img=25", bio: "Food finds",
    location: "Nearby", followersCount: 0, followingCount: 0, postsCount: 0,
    status: "Hat einen neuen Food-Spot",
    messages: [
      { id: "priya-1", senderId: "priya", text: "Ich glaube, ich habe das beste Sandwich hier gefunden.", time: "14:02" },
      { id: "priya-2", senderId: "me", text: "Das ist eine große Behauptung.", time: "14:03" },
      { id: "priya-3", senderId: "priya", text: "Dann musst du testen kommen.", time: "14:04" },
    ],
  },
  {
    id: "sam", name: "Sam", username: "sam",
    avatar: "https://i.pravatar.cc/150?img=33", bio: "Dog walks",
    location: "Nearby", followersCount: 0, followingCount: 0, postsCount: 0,
    status: "Mit Biscuit unterwegs",
    messages: [
      { id: "sam-1", senderId: "sam", text: "Biscuit will neue Menschen kennenlernen.", time: "09:18" },
      { id: "sam-2", senderId: "me", text: "Das klingt nach einem guten Plan.", time: "09:20" },
      { id: "sam-3", senderId: "sam", text: "Wir laufen gleich Richtung Park.", time: "09:21" },
    ],
  },
];

function toChatContacts(postsUsers: User[], currentUserId: string): ChatContact[] {
  const seen = new Set<string>();
  const contacts = postsUsers
    .filter((user) => user.id !== currentUserId)
    .filter((user) => { if (seen.has(user.id)) return false; seen.add(user.id); return true; })
    .slice(0, 8)
    .map((user, index) => ({
      ...user,
      status: ["Online in deiner Nähe", "Gerade aktiv", "Offen für Pläne", "In der Umgebung"][index % 4],
      messages: [
        { id: `${user.id}-1`, senderId: user.id, text: `Hey, ich bin gerade bei ${user.location || "dir in der Nähe"}.`, time: "Jetzt" },
        { id: `${user.id}-2`, senderId: currentUserId, text: "Cool, was machst du gerade?", time: "Jetzt" },
        { id: `${user.id}-3`, senderId: user.id, text: "Noch nichts Festes. Vielleicht ergibt sich etwas.", time: "Jetzt" },
      ],
    }));
  return contacts.length ? contacts : FALLBACK_CONTACTS;
}

function toPartyThreads(parties: Party[], currentUserId: string): ChatThread[] {
  const visibleParties = parties.length ? parties : [DEMO_PARTY];
  return visibleParties.map((party) => {
    const firstMember = party.members[0];
    const secondMember = party.members[1];
    return {
      type: "party",
      id: `party:${party.id}`,
      name: party.name,
      subtitle: `${party.members.length} Mitglieder · ${party.hostName}`,
      icon: "🎉",
      party,
      messages: [
        { id: `${party.id}-party-1`, senderId: party.hostId, text: `${party.hostName} hat die Party gestartet.`, time: "Jetzt" },
        { id: `${party.id}-party-2`, senderId: firstMember?.id ?? party.hostId, text: firstMember ? `${firstMember.name} ist dabei.` : "Wer ist dabei?", time: "Jetzt" },
        { id: `${party.id}-party-3`, senderId: currentUserId, text: secondMember ? `Ich sehe ${secondMember.name} auch auf der Karte.` : "Ich komme gleich dazu.", time: "Jetzt" },
      ],
    };
  });
}

function toGroupThreads(groups: Group[], currentUserId: string): ChatThread[] {
  return groups.map((group) => {
    const firstMember = group.members[0];
    const secondMember = group.members[1];
    return {
      type: "group",
      id: `group:${group.id}`,
      name: group.name,
      subtitle: `${group.members.length} Mitglieder · ${group.ownerName}`,
      icon: "👥",
      group,
      messages: [
        { id: `${group.id}-group-1`, senderId: group.ownerId, text: `${group.ownerName} hat die Gruppe erstellt.`, time: "Jetzt" },
        { id: `${group.id}-group-2`, senderId: firstMember?.id ?? group.ownerId, text: firstMember ? `${firstMember.name} ist dabei.` : "Wer ist dabei?", time: "Jetzt" },
        { id: `${group.id}-group-3`, senderId: currentUserId, text: secondMember ? `${secondMember.name} ist auch eingeladen.` : "Ich bin dabei.", time: "Jetzt" },
      ],
    };
  });
}

// ── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [activeCat, setActiveCat] = useState(EMOJI_CATEGORIES[0].id);
  const currentEmojis = EMOJI_CATEGORIES.find((c) => c.id === activeCat)?.emojis ?? [];

  return (
    <View style={emojiStyles.panel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={emojiStyles.catBar}
        contentContainerStyle={emojiStyles.catBarContent}
      >
        {EMOJI_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setActiveCat(cat.id)}
            style={[emojiStyles.catBtn, activeCat === cat.id && emojiStyles.catBtnActive]}
          >
            <Text style={emojiStyles.catIcon}>{cat.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={emojiStyles.grid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {currentEmojis.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onSelect(emoji)}
            style={({ pressed }) => [emojiStyles.cell, pressed && emojiStyles.cellPressed]}
          >
            <Text style={emojiStyles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const CELL_SIZE = 46;
const emojiStyles = StyleSheet.create({
  panel: {
    height: EMOJI_PANEL_HEIGHT,
    backgroundColor: Colors.light.backgroundTertiary,
    borderTopWidth: 2,
    borderTopColor: Colors.light.text,
  },
  catBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.light.separator },
  catBarContent: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  catBtn: {
    width: 42, height: 42,
    borderRadius: Colors.shape.radiusSm,
    alignItems: "center", justifyContent: "center",
  },
  catBtnActive: { backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1.5, borderColor: Colors.light.tint },
  catIcon: { fontSize: 22 },
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 10, paddingVertical: 8, gap: 2,
  },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    alignItems: "center", justifyContent: "center",
    borderRadius: Colors.shape.radiusSm,
  },
  cellPressed: { backgroundColor: Colors.light.backgroundSecondary },
  emoji: { fontSize: 26 },
});

function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { currentUser, posts, parties, groups, mapFriends, localMessages, addLocalMessage } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const contacts = useMemo(() => toChatContacts(posts.map((p) => p.user), currentUser.id), [currentUser.id, posts]);
  const partyThreads = useMemo(() => toPartyThreads(parties, currentUser.id), [currentUser.id, parties]);
  const groupThreads = useMemo(() => toGroupThreads(groups, currentUser.id), [currentUser.id, groups]);
  const profileThreads = useMemo<ChatThread[]>(
    () => contacts.map((c) => ({ type: "profile", id: c.id, name: c.name, subtitle: c.status, avatar: c.avatar, messages: c.messages, username: c.username, status: c.status })),
    [contacts],
  );
  const mapFriendThreads = useMemo<ChatThread[]>(
    () =>
      mapFriends.map((f) => ({
        type: "profile",
        id: f.id,
        name: f.name,
        subtitle: f.activity,
        avatar: f.avatarUrl,
        username: f.id,
        status: f.activity,
        messages: [
          { id: `${f.id}-map-1`, senderId: f.id, text: f.activity, time: "Jetzt" },
        ],
      })),
    [mapFriends],
  );

  const threads = useMemo(() => {
    const profileIds = new Set(profileThreads.map((t) => t.id));
    const newFriends = mapFriendThreads.filter((t) => !profileIds.has(t.id));
    return [...partyThreads, ...groupThreads, ...newFriends, ...profileThreads];
  }, [groupThreads, mapFriendThreads, partyThreads, profileThreads]);
  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
  const selectedThread = useMemo(() => threads.find((t) => t.id === selectedId) ?? threads[0], [selectedId, threads]);

  useEffect(() => {
    if (!threads.length) return;
    setSelectedId((cur) => (threads.some((t) => t.id === cur) ? cur : threads[0].id));
  }, [threads]);


  const addMessage = useCallback((msg: ChatMessage) => {
    if (!selectedThread) return;
    addLocalMessage(selectedThread.id, msg);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [selectedThread, addLocalMessage]);

  const handleSend = useCallback(() => {
    if (!draft.trim() || !selectedThread) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addMessage({ id: `local-${Date.now()}`, senderId: "me", text: draft.trim(), time: nowTime() });
    setDraft("");
  }, [draft, selectedThread, addMessage]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setDraft((d) => d + emoji);
  }, []);

  const toggleEmoji = useCallback(() => {
    if (!emojiOpen) inputRef.current?.blur();
    setEmojiOpen((open) => !open);
  }, [emojiOpen]);

  const handlePickImage = useCallback(async () => {
    setMediaModalOpen(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addMessage({ id: `img-${Date.now()}`, senderId: "me", text: "", time: nowTime(), imageUri: result.assets[0].uri });
    }
  }, [addMessage]);

  const handleTakePhoto = useCallback(async () => {
    setMediaModalOpen(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addMessage({ id: `cam-${Date.now()}`, senderId: "me", text: "", time: nowTime(), imageUri: result.assets[0].uri });
    }
  }, [addMessage]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => `${c.name} ${c.username} ${c.status}`.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const selectContact = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedId(id);
    setEmojiOpen(false);
  }, []);

  const allMessages = useMemo(
    () => [...(selectedThread?.messages ?? []), ...(localMessages[selectedThread?.id ?? ""] ?? [])],
    [selectedThread, localMessages],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 86 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => router.push("/presence-choice")}>
          <Feather name="home" size={22} color={Colors.light.onBright} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => { setSearchOpen(true); setEmojiOpen(false); }}>
          <Feather name="search" size={21} color={Colors.light.onBright} />
        </Pressable>
      </View>

      {/* Contact list */}
      <View style={styles.peopleWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleList}>
          {threads.map((thread) => {
            const selected = thread.id === selectedThread?.id;
            return (
              <Pressable key={thread.id} style={({ pressed }) => [styles.person, selected && styles.personSelected, { opacity: pressed ? 0.75 : 1 }]} onPress={() => selectContact(thread.id)}>
                <View style={[styles.avatarRing, thread.type !== "profile" && styles.partyRing, selected && styles.avatarRingSelected]}>
                  {thread.type !== "profile"
                    ? <Text style={styles.partyThreadIcon}>{thread.type === "party" ? "🎉" : "👥"}</Text>
                    : <Image source={{ uri: thread.avatar }} style={styles.avatar} contentFit="cover" />}
                  <View style={[styles.onlineDot, thread.type !== "profile" && styles.partyDot]} />
                </View>
                <Text style={[styles.personName, selected && styles.personNameSelected]} numberOfLines={1}>{thread.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {selectedThread ? (
        <>
          {/* Chat header */}
          <View style={styles.chatHeader}>
            {selectedThread.type !== "profile"
              ? <View style={[styles.chatAvatar, styles.chatPartyAvatar]}><Text style={styles.chatPartyIcon}>{selectedThread.type === "party" ? "🎉" : "👥"}</Text></View>
              : <Image source={{ uri: selectedThread.avatar }} style={styles.chatAvatar} contentFit="cover" />}
            <View style={styles.chatHeaderText}>
              <Text style={styles.chatName}>{selectedThread.name}</Text>
              <Text style={styles.chatStatus} numberOfLines={1}>{selectedThread.subtitle}</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Feather name="more-horizontal" size={21} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onTouchStart={() => setEmojiOpen(false)}
            onScrollBeginDrag={() => setEmojiOpen(false)}
          >
            {allMessages.map((message) => {
              const mine = message.senderId === currentUser.id || message.senderId === "me";
              return (
                <View key={message.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {message.imageUri ? (
                      <>
                        <Image source={{ uri: message.imageUri }} style={styles.messageImage} contentFit="cover" />
                        {message.text ? <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>{message.text}</Text> : null}
                      </>
                    ) : (
                      <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>{message.text}</Text>
                    )}
                    <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeTheirs]}>{message.time}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Composer */}
          <View style={[styles.composer, { paddingBottom: emojiOpen ? 8 : TAB_BAR_OVERLAY_HEIGHT + Math.max(insets.bottom, 10) }]}>
            <View style={styles.composerRow}>
              {/* Media button */}
              <Pressable
                style={({ pressed }) => [styles.mediaBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setMediaModalOpen(true); setEmojiOpen(false); }}
              >
                <Feather name="image" size={21} color={Colors.light.tintBlue} />
              </Pressable>

              {/* Input + emoji + send */}
              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => setEmojiOpen(false)}
                  placeholder={`Nachricht an ${selectedThread.name}`}
                  placeholderTextColor={Colors.light.textTertiary}
                  style={styles.input}
                  multiline
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
                <Pressable
                  style={({ pressed }) => [styles.emojiToggleBtn, emojiOpen && styles.emojiToggleBtnActive, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={toggleEmoji}
                >
                  <Text style={styles.emojiToggleIcon}>{emojiOpen ? "⌨️" : "😊"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.82 : 1 }]}
                  onPress={handleSend}
                >
                  <Feather name="send" size={17} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Emoji panel */}
          {emojiOpen && (
            <View style={{ paddingBottom: TAB_BAR_OVERLAY_HEIGHT + Math.max(insets.bottom, 10) }}>
              <EmojiPicker onSelect={handleEmojiSelect} />
            </View>
          )}
        </>
      ) : null}

      {/* Media picker modal */}
      <Modal visible={mediaModalOpen} transparent animationType="slide" onRequestClose={() => setMediaModalOpen(false)}>
        <Pressable style={styles.mediaOverlay} onPress={() => setMediaModalOpen(false)}>
          <Pressable style={[styles.mediaSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.mediaSheetHandle} />
            <Text style={styles.mediaSheetTitle}>Foto senden</Text>
            <Pressable style={({ pressed }) => [styles.mediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handleTakePhoto}>
              <View style={[styles.mediaOptionIcon, { backgroundColor: Colors.light.tint }]}>
                <Feather name="camera" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.mediaOptionLabel}>Foto aufnehmen</Text>
                <Text style={styles.mediaOptionSub}>Kamera öffnen</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.mediaOption, { opacity: pressed ? 0.75 : 1 }]} onPress={handlePickImage}>
              <View style={[styles.mediaOptionIcon, { backgroundColor: Colors.light.tintBlue }]}>
                <Feather name="image" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.mediaOptionLabel}>Aus Galerie wählen</Text>
                <Text style={styles.mediaOptionSub}>Foto aus der Bibliothek</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.mediaCancelBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setMediaModalOpen(false)}>
              <Text style={styles.mediaCancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search modal */}
      <Modal visible={searchOpen} animationType="fade" transparent onRequestClose={() => { setSearchOpen(false); setSearchQuery(""); }}>
        <Pressable style={styles.searchOverlay} onPress={() => { setSearchOpen(false); setSearchQuery(""); }}>
          <Pressable style={styles.searchPanel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.searchPanelHeader}>
              <Text style={styles.searchTitle}>Profile suchen</Text>
              <Pressable style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.72 : 1 }]} onPress={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <Feather name="x" size={20} color={Colors.light.onBright} />
              </Pressable>
            </View>
            <View style={styles.profileSearchInputWrap}>
              <Feather name="search" size={18} color={Colors.light.textSecondary} />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} autoFocus placeholder="Name oder Nutzername" placeholderTextColor={Colors.light.textTertiary} style={styles.profileSearchInput} />
            </View>
            <ScrollView style={styles.searchResults} contentContainerStyle={styles.searchResultsContent}>
              {searchResults.map((contact) => (
                <Pressable key={contact.id} style={({ pressed }) => [styles.searchResult, { opacity: pressed ? 0.78 : 1 }]} onPress={() => { selectContact(contact.id); setSearchOpen(false); setSearchQuery(""); }}>
                  <Image source={{ uri: contact.avatar }} style={styles.searchResultAvatar} contentFit="cover" />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{contact.name}</Text>
                    <Text style={styles.searchResultMeta} numberOfLines={1}>@{contact.username} · {contact.status}</Text>
                  </View>
                  <Feather name="message-circle" size={19} color={Colors.light.tint} />
                </Pressable>
              ))}
              {!searchResults.length && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsTitle}>Nichts gefunden</Text>
                  <Text style={styles.noResultsText}>Versuch einen anderen Namen.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY },
    shadowOpacity: Colors.shadow.opacity, shadowRadius: Colors.shadow.radius,
  },

  peopleWrap: { backgroundColor: Colors.light.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator },
  peopleList: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, gap: 12 },
  person: { width: 72, alignItems: "center", gap: 7 },
  personSelected: { transform: [{ translateY: -1 }] },
  avatarRing: {
    width: 62, height: 62, borderRadius: 31, padding: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY },
    shadowOpacity: Colors.shadow.opacity, shadowRadius: Colors.shadow.radius,
  },
  avatarRingSelected: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint + "18" },
  partyRing: { alignItems: "center", justifyContent: "center", backgroundColor: partyThreadSurface },
  partyThreadIcon: { fontSize: 28, lineHeight: 34 },
  avatar: { width: "100%", height: "100%", borderRadius: 28, backgroundColor: Colors.light.backgroundSecondary },
  onlineDot: {
    position: "absolute", right: 2, bottom: 4, width: 14, height: 14, borderRadius: 7,
    borderWidth: Colors.shape.borderWidthThin, borderColor: Colors.light.background,
    backgroundColor: Colors.light.mint,
  },
  partyDot: { backgroundColor: Colors.light.tint },
  personName: { maxWidth: 68, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  personNameSelected: { color: Colors.light.text, fontFamily: "Inter_700Bold" },

  chatHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 11,
    backgroundColor: Colors.light.backgroundSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
  },
  chatAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.light.backgroundSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator },
  chatPartyAvatar: { alignItems: "center", justifyContent: "center", backgroundColor: partyThreadSurface },
  chatPartyIcon: { fontSize: 24, lineHeight: 30 },
  chatHeaderText: { flex: 1, minWidth: 0 },
  chatName: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  chatStatus: { marginTop: 2, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  moreBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: utilityButtonSurface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
  },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10, backgroundColor: Colors.light.background },
  messageRow: { width: "100%", flexDirection: "row" },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%", borderRadius: 18,
    paddingHorizontal: 13, paddingVertical: 10,
    borderWidth: 0,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY },
    shadowOpacity: 0.18, shadowRadius: Colors.shadow.radius,
  },
  bubbleMine: { backgroundColor: Colors.light.tint },
  bubbleTheirs: { backgroundColor: Colors.light.tintBlue },
  messageImage: { width: 200, height: 160, borderRadius: 8, marginBottom: 4 },
  messageText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  messageTextMine: { color: "#FFFFFF" },
  messageTextTheirs: { color: Colors.light.onBright },
  messageTime: { marginTop: 5, fontSize: 10, fontFamily: "Inter_500Medium", alignSelf: "flex-end" },
  messageTimeMine: { color: "rgba(255,255,255,0.72)" },
  messageTimeTheirs: { color: Colors.light.textTertiary },

  composer: {
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.separator,
    backgroundColor: Colors.light.background,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  mediaBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
  },
  inputWrap: {
    flex: 1, minHeight: 48, borderRadius: 24,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row", alignItems: "flex-end",
    paddingLeft: 14, paddingRight: 6, paddingVertical: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
  },
  input: {
    flex: 1, minHeight: 38, maxHeight: 120,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text,
    paddingVertical: 6,
  },
  emojiToggleBtn: {
    width: 36, height: 36, borderRadius: Colors.shape.radiusSm,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  emojiToggleBtnActive: { backgroundColor: Colors.light.backgroundTertiary },
  emojiToggleIcon: { fontSize: 22 },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.light.tint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 0,
    marginBottom: 2,
  },

  mediaOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  mediaSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.separator,
  },
  mediaSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.separator, alignSelf: "center", marginBottom: 8 },
  mediaSheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, marginBottom: 4 },
  mediaOption: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: Colors.shape.radiusMd,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
  },
  mediaOptionIcon: { width: 48, height: 48, borderRadius: Colors.shape.radiusSm, alignItems: "center", justifyContent: "center" },
  mediaOptionLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  mediaOptionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  mediaCancelBtn: { alignItems: "center", paddingVertical: 14 },
  mediaCancelText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  searchOverlay: { flex: 1, justifyContent: "center", paddingHorizontal: 20, backgroundColor: "rgba(21,34,56,0.42)" },
  searchPanel: {
    maxHeight: "72%", borderRadius: Colors.shape.radiusLg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    backgroundColor: Colors.light.background,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: Colors.shadow.offsetY + 4 },
    shadowOpacity: Colors.shadow.opacity + 0.06, shadowRadius: Colors.shadow.radius,
    overflow: "hidden",
  },
  searchPanelHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  searchTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.text,
    textShadowColor: "transparent",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  profileSearchInputWrap: {
    minHeight: 50, margin: 14, paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  profileSearchInput: { flex: 1, minHeight: 46, fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.light.text },
  searchResults: { maxHeight: 360 },
  searchResultsContent: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  searchResult: {
    minHeight: 68, borderRadius: Colors.shape.radiusMd,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10,
  },
  searchResultAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.light.separator, backgroundColor: Colors.light.backgroundSecondary },
  searchResultText: { flex: 1, minWidth: 0 },
  searchResultName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  searchResultMeta: { marginTop: 2, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  noResults: { alignItems: "center", paddingVertical: 26, gap: 4 },
  noResultsTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  noResultsText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
});
