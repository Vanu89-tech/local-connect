import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { Party, User, useApp } from "@/context/AppContext";

const TAB_BAR_OVERLAY_HEIGHT = 84;

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  time: string;
};

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
    };

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
    id: "maya",
    name: "Maya",
    username: "maya",
    avatar: "https://i.pravatar.cc/150?img=47",
    bio: "Coffee lover",
    location: "Nearby",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    status: "Sucht Kaffee in der Nähe",
    messages: [
      { id: "maya-1", senderId: "maya", text: "Hey, bist du später noch in der Gegend?", time: "12:34" },
      { id: "maya-2", senderId: "me", text: "Ja, wahrscheinlich beim Park. Was geht?", time: "12:36" },
      { id: "maya-3", senderId: "maya", text: "Ich wollte gleich einen kleinen Spaziergang machen.", time: "12:39" },
    ],
  },
  {
    id: "luca",
    name: "Luca",
    username: "luca",
    avatar: "https://i.pravatar.cc/150?img=12",
    bio: "Street photos",
    location: "Nearby",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    status: "Fotografiert gerade draußen",
    messages: [
      { id: "luca-1", senderId: "luca", text: "Der Sonnenuntergang sieht heute wild aus.", time: "18:08" },
      { id: "luca-2", senderId: "me", text: "Schick mal den Spot.", time: "18:10" },
      { id: "luca-3", senderId: "luca", text: "Bin beim kleinen Platz neben der Haltestelle.", time: "18:11" },
    ],
  },
  {
    id: "priya",
    name: "Priya",
    username: "priya",
    avatar: "https://i.pravatar.cc/150?img=25",
    bio: "Food finds",
    location: "Nearby",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    status: "Hat einen neuen Food-Spot",
    messages: [
      { id: "priya-1", senderId: "priya", text: "Ich glaube, ich habe das beste Sandwich hier gefunden.", time: "14:02" },
      { id: "priya-2", senderId: "me", text: "Das ist eine große Behauptung.", time: "14:03" },
      { id: "priya-3", senderId: "priya", text: "Dann musst du testen kommen.", time: "14:04" },
    ],
  },
  {
    id: "sam",
    name: "Sam",
    username: "sam",
    avatar: "https://i.pravatar.cc/150?img=33",
    bio: "Dog walks",
    location: "Nearby",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
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
    .filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    })
    .slice(0, 8)
    .map((user, index) => ({
      ...user,
      status: ["Online in deiner Nähe", "Gerade aktiv", "Offen für Pläne", "In der Umgebung"][index % 4],
      messages: [
        {
          id: `${user.id}-1`,
          senderId: user.id,
          text: `Hey, ich bin gerade bei ${user.location || "dir in der Nähe"}.`,
          time: "Jetzt",
        },
        {
          id: `${user.id}-2`,
          senderId: currentUserId,
          text: "Cool, was machst du gerade?",
          time: "Jetzt",
        },
        {
          id: `${user.id}-3`,
          senderId: user.id,
          text: "Noch nichts Festes. Vielleicht ergibt sich etwas.",
          time: "Jetzt",
        },
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
        {
          id: `${party.id}-party-1`,
          senderId: party.hostId,
          text: `${party.hostName} hat die Party gestartet.`,
          time: "Jetzt",
        },
        {
          id: `${party.id}-party-2`,
          senderId: firstMember?.id ?? party.hostId,
          text: firstMember ? `${firstMember.name} ist dabei.` : "Wer ist dabei?",
          time: "Jetzt",
        },
        {
          id: `${party.id}-party-3`,
          senderId: currentUserId,
          text: secondMember ? `Ich sehe ${secondMember.name} auch auf der Karte.` : "Ich komme gleich dazu.",
          time: "Jetzt",
        },
      ],
    };
  });
}

export default function HomeScreen() {
  const { currentUser, posts, parties } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const contacts = useMemo(
    () => toChatContacts(posts.map((post) => post.user), currentUser.id),
    [currentUser.id, posts],
  );
  const partyThreads = useMemo(
    () => toPartyThreads(parties, currentUser.id),
    [currentUser.id, parties],
  );
  const profileThreads = useMemo<ChatThread[]>(
    () =>
      contacts.map((contact) => ({
        type: "profile",
        id: contact.id,
        name: contact.name,
        subtitle: contact.status,
        avatar: contact.avatar,
        messages: contact.messages,
        username: contact.username,
        status: contact.status,
      })),
    [contacts],
  );
  const threads = useMemo(
    () => [...partyThreads, ...profileThreads],
    [partyThreads, profileThreads],
  );
  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0],
    [selectedId, threads],
  );

  useEffect(() => {
    if (!threads.length) return;
    setSelectedId((current) =>
      threads.some((thread) => thread.id === current) ? current : threads[0].id,
    );
  }, [threads]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.username} ${contact.status}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, searchQuery]);

  const selectContact = (id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedId(id);
  };

  const openSearch = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const chooseSearchResult = (id: string) => {
    selectContact(id);
    closeSearch();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 86 : 0}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.homeModeBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.push("/presence-choice")}
        >
          <Feather name="home" size={22} color={Colors.light.text} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.searchBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={openSearch}
        >
          <Feather name="search" size={21} color={Colors.light.text} />
        </Pressable>
      </View>

      <View style={styles.peopleWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleList}
        >
          {threads.map((thread) => {
            const selected = thread.id === selectedThread?.id;
            return (
              <Pressable
                key={thread.id}
                style={({ pressed }) => [
                  styles.person,
                  selected && styles.personSelected,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => selectContact(thread.id)}
              >
                <View
                  style={[
                    styles.avatarRing,
                    thread.type === "party" && styles.partyRing,
                    selected && styles.avatarRingSelected,
                  ]}
                >
                  {thread.type === "party" ? (
                    <Text style={styles.partyThreadIcon}>🎉</Text>
                  ) : (
                    <Image source={{ uri: thread.avatar }} style={styles.avatar} contentFit="cover" />
                  )}
                  <View style={[styles.onlineDot, thread.type === "party" && styles.partyDot]} />
                </View>
                <Text style={[styles.personName, selected && styles.personNameSelected]} numberOfLines={1}>
                  {thread.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {selectedThread ? (
        <>
          <View style={styles.chatHeader}>
            {selectedThread.type === "party" ? (
              <View style={[styles.chatAvatar, styles.chatPartyAvatar]}>
                <Text style={styles.chatPartyIcon}>🎉</Text>
              </View>
            ) : (
              <Image source={{ uri: selectedThread.avatar }} style={styles.chatAvatar} contentFit="cover" />
            )}
            <View style={styles.chatHeaderText}>
              <Text style={styles.chatName}>{selectedThread.name}</Text>
              <Text style={styles.chatStatus} numberOfLines={1}>
                {selectedThread.subtitle}
              </Text>
            </View>
            <Pressable style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Feather name="more-horizontal" size={21} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedThread.messages.map((message) => {
              const mine = message.senderId === currentUser.id || message.senderId === "me";
              return (
                <View
                  key={message.id}
                  style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>
                      {message.text}
                    </Text>
                    <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeTheirs]}>
                      {message.time}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.composer,
              { paddingBottom: TAB_BAR_OVERLAY_HEIGHT + Math.max(insets.bottom, 10) },
            ]}
          >
            <View style={styles.inputWrap}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Nachricht an ${selectedThread.name}`}
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.input}
              />
              <Pressable style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.82 : 1 }]}>
                <Feather name="send" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      <Modal visible={searchOpen} animationType="fade" transparent onRequestClose={closeSearch}>
        <Pressable style={styles.searchOverlay} onPress={closeSearch}>
          <Pressable style={styles.searchPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.searchPanelHeader}>
              <Text style={styles.searchTitle}>Profile suchen</Text>
              <Pressable style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.72 : 1 }]} onPress={closeSearch}>
                <Feather name="x" size={20} color={Colors.light.text} />
              </Pressable>
            </View>

            <View style={styles.profileSearchInputWrap}>
              <Feather name="search" size={18} color={Colors.light.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                placeholder="Name oder Nutzername"
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.profileSearchInput}
              />
            </View>

            <ScrollView style={styles.searchResults} contentContainerStyle={styles.searchResultsContent}>
              {searchResults.map((contact) => (
                <Pressable
                  key={contact.id}
                  style={({ pressed }) => [styles.searchResult, { opacity: pressed ? 0.78 : 1 }]}
                  onPress={() => chooseSearchResult(contact.id)}
                >
                  <Image source={{ uri: contact.avatar }} style={styles.searchResultAvatar} contentFit="cover" />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{contact.name}</Text>
                    <Text style={styles.searchResultMeta} numberOfLines={1}>
                      @{contact.username} · {contact.status}
                    </Text>
                  </View>
                  <Feather name="message-circle" size={19} color={Colors.light.comicPink} />
                </Pressable>
              ))}
              {!searchResults.length ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsTitle}>Nichts gefunden</Text>
                  <Text style={styles.noResultsText}>Versuch einen anderen Namen.</Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 3,
    borderBottomColor: Colors.light.comicInk,
  },
  homeModeBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.comicYellow,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    shadowColor: Colors.light.comicInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.comicYellow,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    shadowColor: Colors.light.comicInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
  },
  peopleWrap: {
    backgroundColor: "#DFF4FF",
    borderBottomWidth: 3,
    borderBottomColor: Colors.light.comicInk,
  },
  peopleList: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 12,
  },
  person: {
    width: 72,
    alignItems: "center",
    gap: 7,
  },
  personSelected: {
    transform: [{ translateY: -1 }],
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    borderWidth: 3,
    borderColor: Colors.light.comicInk,
    backgroundColor: "#FFFFFF",
    shadowColor: Colors.light.comicInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
  },
  avatarRingSelected: {
    borderColor: Colors.light.comicPink,
    backgroundColor: Colors.light.comicYellow,
  },
  partyRing: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D5FF",
  },
  partyThreadIcon: {
    fontSize: 28,
    lineHeight: 34,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.light.background,
    backgroundColor: Colors.light.comicMint,
  },
  partyDot: {
    backgroundColor: Colors.light.comicPink,
  },
  personName: {
    maxWidth: 68,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    letterSpacing: 0,
  },
  personNameSelected: {
    color: Colors.light.text,
    fontFamily: "Inter_700Bold",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 3,
    borderBottomColor: Colors.light.comicInk,
  },
  chatAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
  },
  chatPartyAvatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9D5FF",
  },
  chatPartyIcon: {
    fontSize: 24,
    lineHeight: 30,
  },
  chatHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    letterSpacing: 0,
  },
  chatStatus: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    letterSpacing: 0,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7ECFF",
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
    backgroundColor: Colors.light.background,
  },
  messageRow: {
    width: "100%",
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    shadowColor: Colors.light.comicInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
  },
  bubbleMine: {
    backgroundColor: Colors.light.comicPink,
  },
  bubbleTheirs: {
    backgroundColor: "#FFFFFF",
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    letterSpacing: 0,
  },
  messageTextMine: {
    color: "#FFFFFF",
  },
  messageTextTheirs: {
    color: Colors.light.text,
  },
  messageTime: {
    marginTop: 5,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    alignSelf: "flex-end",
    letterSpacing: 0,
  },
  messageTimeMine: {
    color: "rgba(255,255,255,0.72)",
  },
  messageTimeTheirs: {
    color: Colors.light.textTertiary,
  },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 3,
    borderTopColor: Colors.light.comicInk,
    backgroundColor: "#DFF4FF",
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 6,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    letterSpacing: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.light.comicBlue,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
  },
  searchOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(21,34,56,0.42)",
  },
  searchPanel: {
    maxHeight: "72%",
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Colors.light.comicInk,
    backgroundColor: Colors.light.background,
    shadowColor: Colors.light.comicInk,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 0,
    overflow: "hidden",
  },
  searchPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: Colors.light.comicInk,
    backgroundColor: "#DFF4FF",
  },
  searchTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    letterSpacing: 0,
    textShadowColor: Colors.light.comicYellow,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    backgroundColor: Colors.light.comicYellow,
  },
  profileSearchInputWrap: {
    minHeight: 50,
    margin: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileSearchInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    letterSpacing: 0,
  },
  searchResults: {
    maxHeight: 360,
  },
  searchResultsContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  searchResult: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  searchResultAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: Colors.light.comicInk,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  searchResultText: {
    flex: 1,
    minWidth: 0,
  },
  searchResultName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    letterSpacing: 0,
  },
  searchResultMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    letterSpacing: 0,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 26,
    gap: 4,
  },
  noResultsTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    letterSpacing: 0,
  },
  noResultsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    letterSpacing: 0,
  },
});
