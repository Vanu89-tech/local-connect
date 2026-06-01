import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type User = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
};

export type Post = {
  id: string;
  userId: string;
  user: User;
  content: string;
  imageUrl?: string;
  location: string;
  likesCount: number;
  commentsCount: number;
  liked: boolean;
  category: PostCategory;
  status: PostStatus;
  createdAt: string;
};

export type PostCategory =
  | "general"
  | "question"
  | "event"
  | "recommendation"
  | "found"
  | "warning"
  | "party";

export type PostStatus = "pending" | "visible" | "hidden" | "removed";

export type ReportReason =
  | "harassment"
  | "hate"
  | "sexual"
  | "violence"
  | "spam"
  | "private_info"
  | "wrong_location"
  | "other";

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
};

export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  time: string;
  clientMessageId?: string;
  imageUri?: string;
  createdAt?: string;
  status?: ChatMessageStatus;
  deliveredAt?: string;
  readAt?: string;
  failedReason?: string;
};

export type MapFriend = {
  id: string;
  name: string;
  avatarUrl: string;
  activity: string;
};

export type PartyMember = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type Party = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hostId: string;
  hostName: string;
  members: PartyMember[];
  createdAt: string;
};

export type GroupMember = {
  id: string;
  name: string;
  avatar: string;
  activity: string;
};

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  members: GroupMember[];
  createdAt: string;
};

const SEED_USERS: User[] = [
  {
    id: "u1",
    name: "Maya Chen",
    username: "mayac",
    avatar: "https://i.pravatar.cc/150?img=47",
    bio: "Coffee lover & local explorer ☕ Finding hidden gems in the city",
    location: "Brooklyn, NY",
    followersCount: 234,
    followingCount: 189,
    postsCount: 47,
  },
  {
    id: "u2",
    name: "Luca Romano",
    username: "lucar",
    avatar: "https://i.pravatar.cc/150?img=12",
    bio: "Photographer | Street art enthusiast | Always up for a walk",
    location: "Williamsburg, NY",
    followersCount: 512,
    followingCount: 302,
    postsCount: 93,
  },
  {
    id: "u3",
    name: "Priya Nair",
    username: "priyan",
    avatar: "https://i.pravatar.cc/150?img=25",
    bio: "Local foodie. I try every spot before you do.",
    location: "Park Slope, NY",
    followersCount: 789,
    followingCount: 421,
    postsCount: 128,
  },
  {
    id: "u4",
    name: "Sam Torres",
    username: "samtt",
    avatar: "https://i.pravatar.cc/150?img=33",
    bio: "Dog dad 🐕 weekend hiker | Neighborhood watch",
    location: "Astoria, NY",
    followersCount: 156,
    followingCount: 201,
    postsCount: 31,
  },
];

const SEED_POSTS: Post[] = [
  {
    id: "p1",
    userId: "u2",
    user: SEED_USERS[1],
    content:
      "Golden hour at the Williamsburg Bridge never gets old. This city has some magic at 6pm.",
    imageUrl: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80",
    location: "Williamsburg Bridge",
    likesCount: 87,
    commentsCount: 12,
    liked: false,
    category: "general",
    status: "visible",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: "p2",
    userId: "u3",
    user: SEED_USERS[2],
    content:
      "Just discovered this tiny ramen spot on 5th Ave — no sign, 8 seats, absolutely incredible broth. Worth the wait.",
    location: "Park Slope, Brooklyn",
    likesCount: 143,
    commentsCount: 28,
    liked: true,
    category: "recommendation",
    status: "visible",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "p3",
    userId: "u4",
    user: SEED_USERS[3],
    content:
      "Morning walk with Biscuit through Astoria Park. Best part of the day, every day. 🐕",
    imageUrl: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=600&q=80",
    location: "Astoria Park",
    likesCount: 56,
    commentsCount: 7,
    liked: false,
    category: "general",
    status: "visible",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "p4",
    userId: "u1",
    user: SEED_USERS[0],
    content:
      "New mural went up overnight on Bedford Ave. Street art is the city's heartbeat.",
    imageUrl: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&q=80",
    location: "Bedford Ave, Brooklyn",
    likesCount: 201,
    commentsCount: 19,
    liked: false,
    category: "general",
    status: "visible",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
];

const SEED_COMMENTS: Comment[] = [
  {
    id: "c1",
    postId: "p1",
    userId: "u1",
    user: SEED_USERS[0],
    content: "This shot is incredible! What camera are you using?",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: "c2",
    postId: "p1",
    userId: "u3",
    user: SEED_USERS[2],
    content: "I live right by this bridge and never take photos. You're inspiring me.",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "c3",
    postId: "p2",
    userId: "u2",
    user: SEED_USERS[1],
    content: "No sign is always the best sign. Adding to my list!",
    createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
  },
  {
    id: "c4",
    postId: "p2",
    userId: "u4",
    user: SEED_USERS[3],
    content: "What's the name?? I need this in my life.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "c5",
    postId: "p2",
    userId: "u1",
    user: SEED_USERS[0],
    content: "Going this weekend for sure. Thanks for the tip!",
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
  {
    id: "c6",
    postId: "p3",
    userId: "u2",
    user: SEED_USERS[1],
    content: "Biscuit for president 🐾",
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
  },
  {
    id: "c7",
    postId: "p4",
    userId: "u3",
    user: SEED_USERS[2],
    content: "Walked past this this morning! So vibrant.",
    createdAt: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
  },
];

const ME: User = {
  id: "me",
  name: "Alex Park",
  username: "alexpark",
  avatar: "https://i.pravatar.cc/150?img=60",
  bio: "Exploring my neighborhood one block at a time",
  location: "Manhattan, NY",
  followersCount: 88,
  followingCount: 143,
  postsCount: 0,
};

type AppContextType = {
  currentUser: User;
  posts: Post[];
  comments: Comment[];
  parties: Party[];
  groups: Group[];
  mapFriends: MapFriend[];
  setMapFriends: (friends: MapFriend[]) => void;
  localMessages: Record<string, ChatMessage[]>;
  addLocalMessage: (threadId: string, msg: ChatMessage) => void;
  markThreadRead: (threadId: string) => Promise<void>;
  refreshSocialThreads: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  addPost: (
    content: string,
    location: string,
    imageUrl?: string,
    category?: PostCategory,
  ) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  reportPost: (postId: string, reason?: ReportReason) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => void;
  getCommentsForPost: (postId: string) => Comment[];
  getPostById: (postId: string) => Post | undefined;
  updateProfileLocation: (locationName: string) => Promise<void>;
  createGroup: (name: string, members: GroupMember[]) => string;
  deleteGroup: (id: string) => void;
  updateGroupMembers: (id: string, members: GroupMember[]) => void;
  createParty: (name: string, lat: number, lng: number, members: PartyMember[]) => string;
  deleteParty: (id: string) => void;
  updatePartyMembers: (id: string, members: PartyMember[]) => void;
};

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "localsocial_data";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  home_location_name: string | null;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
};

type PostRow = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  location_name: string;
  likes_count: number;
  comments_count: number;
  category: PostCategory | null;
  status: PostStatus | null;
  created_at: string;
};

type GroupRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  profile_id: string;
  activity: string | null;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type PartyRow = {
  id: string;
  host_id: string;
  name: string;
  lat: number;
  lng: number;
  created_at: string;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type PartyMemberRow = {
  party_id: string;
  profile_id: string;
  lat: number;
  lng: number;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type ChatMessageRow = {
  id: string;
  thread_type: "group" | "party";
  thread_id: string;
  sender_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
  client_message_id?: string | null;
  status?: ChatMessageStatus | null;
  delivered_at?: string | null;
  read_at?: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function isMissingModerationColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as SupabaseErrorLike).code;
  const message = (error as SupabaseErrorLike).message;
  return (
    code === "42703" &&
    typeof message === "string" &&
    (message.includes("posts.category") || message.includes("posts.status"))
  );
}

function makeAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(seed)}`;
}

function makeLocalUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatMessageTime(iso: string): string {
  const created = new Date(iso);
  return `${created.getHours().toString().padStart(2, "0")}:${created
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function compareMessagesByCreatedAt(a: ChatMessage, b: ChatMessage): number {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return aTime - bTime;
}

function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    const key = message.clientMessageId ?? message.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, message);
      return;
    }
    byKey.set(key, {
      ...existing,
      ...message,
      status:
        message.status === "failed"
          ? existing.status
          : message.status ?? existing.status,
    });
  });
  return Array.from(byKey.values()).sort(compareMessagesByCreatedAt);
}

function mapChatMessageRow(message: ChatMessageRow): ChatMessage {
  return {
    id: message.id,
    senderId: message.sender_id,
    text: message.text,
    time: formatMessageTime(message.created_at),
    clientMessageId: message.client_message_id ?? undefined,
    imageUri: message.image_url ?? undefined,
    createdAt: message.created_at,
    status: message.status ?? "sent",
    deliveredAt: message.delivered_at ?? undefined,
    readAt: message.read_at ?? undefined,
  };
}

function hasMissingChatReliabilityColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as SupabaseErrorLike).code;
  const message = (error as SupabaseErrorLike).message;
  return code === "42703" && typeof message === "string" && message.includes("chat_messages");
}

function isMissingChatReliabilitySchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as SupabaseErrorLike).code;
  return code === "42703" || code === "42P01";
}

function isRemoteImageUri(uri: string | undefined): boolean {
  return !!uri && /^https?:\/\//i.test(uri);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function firstProfile(profile: ProfileRow | ProfileRow[] | null | undefined): ProfileRow | null {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function mapProfileToUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.display_name,
    username: profile.username ?? profile.id.slice(0, 8),
    avatar: profile.avatar_url ?? makeAvatarUrl(profile.id),
    bio: profile.bio ?? "",
    location: profile.home_location_name ?? "",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  };
}

function areUsersEqual(a: User, b: User): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.username === b.username &&
    a.avatar === b.avatar &&
    a.bio === b.bio &&
    a.location === b.location &&
    a.followersCount === b.followersCount &&
    a.followingCount === b.followingCount &&
    a.postsCount === b.postsCount
  );
}

function arePostsEqual(a: Post[], b: Post[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.userId !== y.userId ||
      x.content !== y.content ||
      x.imageUrl !== y.imageUrl ||
      x.location !== y.location ||
      x.likesCount !== y.likesCount ||
      x.commentsCount !== y.commentsCount ||
      x.liked !== y.liked ||
      x.category !== y.category ||
      x.status !== y.status ||
      x.createdAt !== y.createdAt ||
      !areUsersEqual(x.user, y.user)
    ) {
      return false;
    }
  }
  return true;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [comments, setComments] = useState<Comment[]>(SEED_COMMENTS);
  const [parties, setParties] = useState<Party[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(ME);
  const [mapFriends, setMapFriends] = useState<MapFriend[]>([]);
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({});
  const [hydrated, setHydrated] = useState(false);

  const mergeThreadMessages = useCallback((threadId: string, messages: ChatMessage[]) => {
    setLocalMessages((prev) => ({
      ...prev,
      [threadId]: dedupeMessages([...(prev[threadId] ?? []), ...messages]),
    }));
  }, []);

  const updateMessageStatus = useCallback(
    (threadId: string, messageKey: string, patch: Partial<ChatMessage>) => {
      setLocalMessages((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] ?? []).map((message) =>
          message.id === messageKey || message.clientMessageId === messageKey
            ? { ...message, ...patch }
            : message,
        ),
      }));
    },
    [],
  );

  const uploadChatImage = useCallback(
    async (imageUri: string | undefined, clientMessageId: string): Promise<string | undefined> => {
      if (!imageUri || isRemoteImageUri(imageUri) || !user) return imageUri;

      const response = await fetch(imageUri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      const extension =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/heic"
            ? "heic"
            : mimeType === "image/webp"
              ? "webp"
              : "jpg";
      const filePath = `${user.id}/${clientMessageId}.${extension}`;

      const { error } = await supabase.storage.from("chat-images").upload(filePath, blob, {
        contentType: mimeType,
        upsert: false,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("chat-images").getPublicUrl(filePath);
      return data.publicUrl;
    },
    [user],
  );

  const addLocalMessage = useCallback((threadId: string, msg: ChatMessage) => {
    const now = new Date().toISOString();
    const clientMessageId = msg.clientMessageId ?? (isUuid(msg.id) ? `client-${msg.id}` : msg.id);
    const optimisticMessage: ChatMessage = {
      ...msg,
      id: msg.id || clientMessageId,
      clientMessageId,
      createdAt: msg.createdAt ?? now,
      time: msg.time || formatMessageTime(now),
      status: user ? "sending" : "sent",
    };

    setLocalMessages((prev) => ({
      ...prev,
      [threadId]: dedupeMessages([...(prev[threadId] ?? []), optimisticMessage]),
    }));
    if (!user) return;
    const [threadType, rawThreadId] = threadId.split(":");
    if ((threadType !== "group" && threadType !== "party") || !isUuid(rawThreadId)) {
      updateMessageStatus(threadId, clientMessageId, { status: "sent" });
      return;
    }

    void (async () => {
      try {
        const remoteImageUrl = await uploadChatImage(msg.imageUri, clientMessageId);
        const messageId = isUuid(msg.id) ? msg.id : makeLocalUuid();
        const insertPayload = {
          id: messageId,
          thread_type: threadType,
          thread_id: rawThreadId,
          sender_id: user.id,
          text: msg.text,
          image_url: remoteImageUrl ?? null,
          client_message_id: clientMessageId,
          message_type: remoteImageUrl ? "image" : "text",
          status: "sent",
        };

        const { data, error } = await supabase
          .from("chat_messages")
          .insert(insertPayload)
          .select("id, thread_type, thread_id, sender_id, text, image_url, created_at, client_message_id, status, delivered_at, read_at")
          .single<ChatMessageRow>();

        if (error) {
          if (!hasMissingChatReliabilityColumns(error)) throw error;
          const { data: legacyData, error: legacyError } = await supabase
            .from("chat_messages")
            .insert({
              id: messageId,
              thread_type: threadType,
              thread_id: rawThreadId,
              sender_id: user.id,
              text: msg.text,
              image_url: remoteImageUrl ?? null,
            })
            .select("id, thread_type, thread_id, sender_id, text, image_url, created_at")
            .single<ChatMessageRow>();
          if (legacyError) throw legacyError;
          mergeThreadMessages(threadId, [{ ...mapChatMessageRow(legacyData), clientMessageId }]);
          return;
        }

        if (data) mergeThreadMessages(threadId, [mapChatMessageRow(data)]);
      } catch (error) {
        updateMessageStatus(threadId, clientMessageId, {
          status: "failed",
          failedReason: error instanceof Error ? error.message : "Nachricht konnte nicht gesendet werden.",
        });
      }
    })();
  }, [mergeThreadMessages, updateMessageStatus, uploadChatImage, user]);

  useEffect(() => {
    loadData();
  }, []);

  const refreshPosts = useCallback(async () => {
    if (!user) {
      await loadData();
      return;
    }

    let postRows: PostRow[] | null = null;

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, author_id, content, image_url, location_name, likes_count, comments_count, category, status, created_at",
      )
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .returns<PostRow[]>();

    if (error) {
      if (!isMissingModerationColumns(error)) throw error;

      const { data: legacyData, error: legacyError } = await supabase
        .from("posts")
        .select(
          "id, author_id, content, image_url, location_name, likes_count, comments_count, created_at",
        )
        .order("created_at", { ascending: false })
        .returns<PostRow[]>();

      if (legacyError) throw legacyError;
      postRows = legacyData;
    } else {
      postRows = data;
    }

    const authorIds = Array.from(new Set((postRows ?? []).map((post) => post.author_id)));
    const postIds = (postRows ?? []).map((post) => post.id);

    const { data: profileRows } = authorIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio, home_location_name")
          .in("id", authorIds)
          .returns<ProfileRow[]>()
      : { data: [] as ProfileRow[] };

    const { data: likedRows } = postIds.length
      ? await supabase
          .from("post_likes")
          .select("post_id")
          .eq("profile_id", user.id)
          .in("post_id", postIds)
          .returns<{ post_id: string }[]>()
      : { data: [] as { post_id: string }[] };

    const profilesById = new Map(
      (profileRows ?? []).map((profile) => [profile.id, mapProfileToUser(profile)]),
    );
    const likedPostIds = new Set((likedRows ?? []).map((like) => like.post_id));

    const nextPosts = (postRows ?? []).map((post) => {
      const author =
        profilesById.get(post.author_id) ??
        ({
          ...ME,
          id: post.author_id,
          name: "Local",
          username: post.author_id.slice(0, 8),
          avatar: makeAvatarUrl(post.author_id),
        } satisfies User);

      return {
        id: post.id,
        userId: post.author_id,
        user: author,
        content: post.content,
        imageUrl: post.image_url ?? undefined,
        location: post.location_name,
        likesCount: post.likes_count,
        commentsCount: post.comments_count,
        liked: likedPostIds.has(post.id),
        category: post.category ?? "general",
        status: post.status ?? "visible",
        createdAt: post.created_at,
      };
    });

    setPosts((prev) => (arePostsEqual(prev, nextPosts) ? prev : nextPosts));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshPosts();
  }, [refreshPosts, user]);

  const refreshSocialThreads = useCallback(async () => {
    if (!user) return;

    const { data: ownedGroups } = await supabase
      .from("groups")
      .select("id, owner_id, name, created_at")
      .eq("owner_id", user.id)
      .returns<GroupRow[]>();

    const { data: memberGroupRows } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", user.id)
      .returns<{ group_id: string }[]>();

    const memberGroupIds = Array.from(new Set((memberGroupRows ?? []).map((row) => row.group_id)));
    const { data: joinedGroups } = memberGroupIds.length
      ? await supabase
          .from("groups")
          .select("id, owner_id, name, created_at")
          .in("id", memberGroupIds)
          .returns<GroupRow[]>()
      : { data: [] as GroupRow[] };

    const groupRows = Array.from(
      new Map([...(ownedGroups ?? []), ...(joinedGroups ?? [])].map((group) => [group.id, group])).values(),
    );
    const groupIds = groupRows.map((group) => group.id);
    const ownerIds = Array.from(new Set(groupRows.map((group) => group.owner_id)));

    const { data: groupMemberRows } = groupIds.length
      ? await supabase
          .from("group_members")
          .select("group_id, profile_id, activity, profiles(id, username, display_name, avatar_url, bio, home_location_name)")
          .in("group_id", groupIds)
          .returns<GroupMemberRow[]>()
      : { data: [] as GroupMemberRow[] };

    const { data: ownerProfiles } = ownerIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio, home_location_name")
          .in("id", ownerIds)
          .returns<ProfileRow[]>()
      : { data: [] as ProfileRow[] };
    const ownerById = new Map((ownerProfiles ?? []).map((profile) => [profile.id, mapProfileToUser(profile)]));

    setGroups(
      groupRows.map((group) => ({
        id: group.id,
        name: group.name,
        ownerId: group.owner_id,
        ownerName: ownerById.get(group.owner_id)?.name ?? "Local",
        createdAt: group.created_at,
        members: (groupMemberRows ?? [])
          .filter((member) => member.group_id === group.id)
          .map((member) => {
            const profile = firstProfile(member.profiles);
            return {
              id: member.profile_id,
              name: profile?.display_name ?? "Local",
              avatar: profile?.avatar_url ?? makeAvatarUrl(member.profile_id),
              activity: member.activity ?? "Gerade online unterwegs",
            };
          }),
      })),
    );

    const { data: partyRows } = await supabase
      .from("parties")
      .select("id, host_id, name, lat, lng, created_at, profiles(id, username, display_name, avatar_url, bio, home_location_name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<PartyRow[]>();

    const partyIds = (partyRows ?? []).map((party) => party.id);
    const { data: partyMemberRows } = partyIds.length
      ? await supabase
          .from("party_members")
          .select("party_id, profile_id, lat, lng, profiles(id, username, display_name, avatar_url, bio, home_location_name)")
          .in("party_id", partyIds)
          .returns<PartyMemberRow[]>()
      : { data: [] as PartyMemberRow[] };

    setParties(
      (partyRows ?? []).map((party) => {
        const host = firstProfile(party.profiles);
        return {
          id: party.id,
          name: party.name,
          lat: party.lat,
          lng: party.lng,
          hostId: party.host_id,
          hostName: host?.display_name ?? "Local",
          createdAt: party.created_at,
          members: (partyMemberRows ?? [])
            .filter((member) => member.party_id === party.id)
            .map((member) => {
              const profile = firstProfile(member.profiles);
              return {
                id: member.profile_id,
                name: profile?.display_name ?? "Local",
                lat: member.lat,
                lng: member.lng,
              };
            }),
        };
      }),
    );

    const threadFilters = [
      ...groupIds.map((id) => `and(thread_type.eq.group,thread_id.eq.${id})`),
      ...partyIds.map((id) => `and(thread_type.eq.party,thread_id.eq.${id})`),
    ];
    if (threadFilters.length) {
      let messageRows: ChatMessageRow[] | null = null;
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_type, thread_id, sender_id, text, image_url, created_at, client_message_id, status, delivered_at, read_at")
        .or(threadFilters.join(","))
        .order("created_at", { ascending: true })
        .returns<ChatMessageRow[]>();

      if (error) {
        if (!hasMissingChatReliabilityColumns(error)) {
          console.warn("chat messages refresh failed", error.message);
        } else {
          const { data: legacyData, error: legacyError } = await supabase
            .from("chat_messages")
            .select("id, thread_type, thread_id, sender_id, text, image_url, created_at")
            .or(threadFilters.join(","))
            .order("created_at", { ascending: true })
            .returns<ChatMessageRow[]>();
          if (legacyError) console.warn("legacy chat messages refresh failed", legacyError.message);
          messageRows = legacyData;
        }
      } else {
        messageRows = data;
      }

      const nextMessages: Record<string, ChatMessage[]> = {};
      (messageRows ?? []).forEach((message) => {
        const key = `${message.thread_type}:${message.thread_id}`;
        nextMessages[key] = [
          ...(nextMessages[key] ?? []),
          mapChatMessageRow(message),
        ];
      });
      setLocalMessages((prev) => {
        const merged = { ...prev };
        Object.entries(nextMessages).forEach(([threadId, messages]) => {
          merged[threadId] = dedupeMessages([...(prev[threadId] ?? []), ...messages]);
        });
        return merged;
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshSocialThreads();
    const interval = setInterval(() => {
      void refreshSocialThreads();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshSocialThreads, user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`locals-chat-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (!row.thread_type || !row.thread_id) return;
          mergeThreadMessages(`${row.thread_type}:${row.thread_id}`, [mapChatMessageRow(row)]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mergeThreadMessages, user]);

  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshSocialThreads();
    });
    return () => subscription.remove();
  }, [refreshSocialThreads, user]);

  const markThreadRead = useCallback(async (threadId: string) => {
    if (!user) return;
    const unreadMessages = (localMessages[threadId] ?? []).filter(
      (message) => message.senderId !== user.id && isUuid(message.id) && !message.readAt,
    );
    if (!unreadMessages.length) return;

    const readAt = new Date().toISOString();
    setLocalMessages((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).map((message) =>
        unreadMessages.some((unread) => unread.id === message.id)
          ? { ...message, status: "read", readAt }
          : message,
      ),
    }));

    const receiptRows = unreadMessages.map((message) => ({
      message_id: message.id,
      profile_id: user.id,
      delivered_at: message.deliveredAt ?? readAt,
      read_at: readAt,
    }));

    const { error } = await supabase.from("message_receipts").upsert(receiptRows);
    if (error && !isMissingChatReliabilitySchema(error)) {
      console.warn("message receipts update failed", error.message);
    }
  }, [localMessages, user]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setCurrentUser((prev) => (areUsersEqual(prev, ME) ? prev : ME));
        return;
      }

      const emailName = user.email?.split("@")[0] ?? user.id.slice(0, 8);
      const metadata = user.user_metadata;
      const displayName =
        typeof metadata["display_name"] === "string" && metadata["display_name"].trim()
          ? metadata["display_name"].trim()
          : emailName;
      const username =
        typeof metadata["username"] === "string" && metadata["username"].trim()
          ? metadata["username"].trim().toLowerCase()
          : emailName.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const avatarUrl =
        typeof metadata["avatar_url"] === "string" && metadata["avatar_url"].trim()
          ? metadata["avatar_url"].trim()
          : null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, home_location_name")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (data && !error) {
        const nextUser = mapProfileToUser(data);
        setCurrentUser((prev) => (areUsersEqual(prev, nextUser) ? prev : nextUser));
        return;
      }

      const fallbackProfile = {
        id: user.id,
        username,
        display_name: displayName,
        avatar_url: avatarUrl,
      };

      const { data: upserted } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" })
        .select("id, username, display_name, avatar_url, bio, home_location_name")
        .single<ProfileRow>();

      const nextUser =
        upserted
          ? mapProfileToUser(upserted)
          : {
              ...ME,
              id: user.id,
              name: displayName,
              username,
              avatar: avatarUrl ?? makeAvatarUrl(user.id),
            };
      setCurrentUser((prev) => (areUsersEqual(prev, nextUser) ? prev : nextUser));
    };

    void loadProfile();
  }, [user]);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.posts?.length > 0) setPosts(parsed.posts);
        if (parsed.comments?.length > 0) setComments(parsed.comments);
        if (Array.isArray(parsed.parties)) setParties(parsed.parties);
        if (Array.isArray(parsed.groups)) setGroups(parsed.groups);
        if (parsed.localMessages && typeof parsed.localMessages === "object") {
          setLocalMessages(parsed.localMessages);
        }
      }
    } catch (_) {
    } finally {
      setHydrated(true);
    }
  };

  const saveData = useCallback(
    async (newPosts: Post[], newComments: Comment[]) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            posts: newPosts,
            comments: newComments,
            parties,
            groups,
            localMessages,
          })
        );
      } catch (_) {}
    },
    [groups, localMessages, parties]
  );

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ posts, comments, parties, groups, localMessages }),
    );
  }, [comments, groups, hydrated, localMessages, parties, posts]);

  const addPost = useCallback(
    async (
      content: string,
      location: string,
      imageUrl?: string,
      category: PostCategory = "general",
    ) => {
      let postId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      let createdAt = new Date().toISOString();

      if (user) {
        const insertPayload = {
          author_id: currentUser.id,
          content,
          image_url: imageUrl ?? null,
          location_name: location,
          category,
          status: "visible",
        };
        const { data, error } = await supabase
          .from("posts")
          .insert(insertPayload)
          .select("id, created_at")
          .single<{ id: string; created_at: string }>();

        if (error) {
          if (!isMissingModerationColumns(error)) throw error;

          const { data: legacyData, error: legacyError } = await supabase
            .from("posts")
            .insert({
              author_id: currentUser.id,
              content,
              image_url: imageUrl ?? null,
              location_name: location,
            })
            .select("id, created_at")
            .single<{ id: string; created_at: string }>();

          if (legacyError) throw legacyError;
          postId = legacyData.id;
          createdAt = legacyData.created_at;
        } else {
          postId = data.id;
          createdAt = data.created_at;
        }
      }

      const newPost: Post = {
        id: postId,
        userId: currentUser.id,
        user: currentUser,
        content,
        imageUrl,
        location,
        likesCount: 0,
        commentsCount: 0,
        liked: false,
        category,
        status: "visible",
        createdAt,
      };
      const updated = [newPost, ...posts];
      setPosts(updated);
      if (!user) saveData(updated, comments);
    },
    [posts, comments, currentUser, saveData, user]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const updated = posts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          liked: !p.liked,
          likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1,
        };
      });
      setPosts(updated);

      try {
        if (user) {
          if (post.liked) {
            const { error } = await supabase
              .from("post_likes")
              .delete()
              .eq("post_id", postId)
              .eq("profile_id", user.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("post_likes")
              .insert({ post_id: postId, profile_id: user.id });
            if (error) throw error;
          }
          await refreshPosts();
          return;
        }

        saveData(updated, comments);
      } catch (error) {
        setPosts(posts);
        throw error;
      }
    },
    [posts, comments, refreshPosts, saveData, user]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      const previousPosts = posts;
      setPosts((prev) => prev.filter((post) => post.id !== postId));

      try {
        if (user) {
          const { error } = await supabase
            .from("posts")
            .delete()
            .eq("id", postId)
            .eq("author_id", user.id);
          if (error) throw error;
          return;
        }

        const updatedPosts = previousPosts.filter((post) => post.id !== postId);
        const updatedComments = comments.filter((comment) => comment.postId !== postId);
        setComments(updatedComments);
        await saveData(updatedPosts, updatedComments);
      } catch (error) {
        setPosts(previousPosts);
        throw error;
      }
    },
    [comments, posts, saveData, user],
  );

  const reportPost = useCallback(
    async (postId: string, reason: ReportReason = "other") => {
      if (!user) return;

      const { error } = await supabase.from("post_reports").insert({
        post_id: postId,
        reporter_id: user.id,
        reason,
      });

      if (error && error.code !== "23505") throw error;
    },
    [user],
  );

  const addComment = useCallback(
    (postId: string, content: string) => {
      const newComment: Comment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        postId,
        userId: currentUser.id,
        user: currentUser,
        content,
        createdAt: new Date().toISOString(),
      };
      const updatedComments = [...comments, newComment];
      const updatedPosts = posts.map((p) =>
        p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      );
      setComments(updatedComments);
      setPosts(updatedPosts);
      saveData(updatedPosts, updatedComments);
    },
    [comments, posts, currentUser, saveData]
  );

  const getCommentsForPost = useCallback(
    (postId: string) => comments.filter((c) => c.postId === postId),
    [comments]
  );

  const getPostById = useCallback(
    (postId: string) => posts.find((p) => p.id === postId),
    [posts]
  );

  const createGroup = useCallback(
    (name: string, members: GroupMember[]) => {
      const groupId = makeLocalUuid();
      const newGroup: Group = {
        id: groupId,
        name,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        members,
        createdAt: new Date().toISOString(),
      };
      setGroups((prev) => [newGroup, ...prev]);
      if (user) {
        void (async () => {
          const { error } = await supabase.from("groups").insert({
            id: groupId,
            owner_id: user.id,
            name,
          });
          if (error) {
            console.warn("group insert failed", error.message);
            return;
          }
          const memberRows = members
            .filter((member) => isUuid(member.id))
            .map((member) => ({
              group_id: groupId,
              profile_id: member.id,
              activity: member.activity,
              invited_by: user.id,
            }));
          if (memberRows.length) {
            const { error: memberError } = await supabase.from("group_members").upsert(memberRows);
            if (memberError) console.warn("group members insert failed", memberError.message);
          }
        })();
      }
      return groupId;
    },
    [currentUser.id, currentUser.name, user],
  );

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((group) => group.id !== id));
    setLocalMessages((prev) => {
      const next = { ...prev };
      delete next[`group:${id}`];
      return next;
    });
    if (user && isUuid(id)) {
      void supabase.from("groups").delete().eq("id", id).eq("owner_id", user.id);
    }
  }, [user]);

  const updateGroupMembers = useCallback((id: string, members: GroupMember[]) => {
    setGroups((prev) => prev.map((group) => (group.id === id ? { ...group, members } : group)));
    if (!user || !isUuid(id)) return;
    void (async () => {
      const { error: deleteError } = await supabase.from("group_members").delete().eq("group_id", id);
      if (deleteError) {
        console.warn("group members delete failed", deleteError.message);
        return;
      }
      const memberRows = members
        .filter((member) => isUuid(member.id))
        .map((member) => ({
          group_id: id,
          profile_id: member.id,
          activity: member.activity,
          invited_by: user.id,
        }));
      if (memberRows.length) {
        const { error } = await supabase.from("group_members").upsert(memberRows);
        if (error) console.warn("group members update failed", error.message);
      }
    })();
  }, [user]);

  const createParty = useCallback(
    (name: string, lat: number, lng: number, members: PartyMember[]) => {
      const partyId = makeLocalUuid();
      const newParty: Party = {
        id: partyId,
        name,
        lat,
        lng,
        hostId: currentUser.id,
        hostName: currentUser.name,
        members,
        createdAt: new Date().toISOString(),
      };
      setParties((prev) => [...prev, newParty]);
      if (user) {
        void (async () => {
          const { error } = await supabase.from("parties").insert({
            id: partyId,
            host_id: user.id,
            name,
            lat,
            lng,
            is_active: true,
          });
          if (error) {
            console.warn("party insert failed", error.message);
            return;
          }
          const memberRows = members
            .filter((member) => isUuid(member.id))
            .map((member) => ({
              party_id: partyId,
              profile_id: member.id,
              lat: member.lat,
              lng: member.lng,
              invited_by: user.id,
            }));
          if (memberRows.length) {
            const { error: memberError } = await supabase.from("party_members").upsert(memberRows);
            if (memberError) console.warn("party members insert failed", memberError.message);
          }
        })();
      }
      return partyId;
    },
    [currentUser, user]
  );

  const deleteParty = useCallback((id: string) => {
    setParties((prev) => prev.filter((p) => p.id !== id));
    setLocalMessages((prev) => {
      const next = { ...prev };
      delete next[`party:${id}`];
      return next;
    });
    if (user && isUuid(id)) {
      void supabase.from("parties").delete().eq("id", id).eq("host_id", user.id);
    }
  }, [user]);

  const updatePartyMembers = useCallback((id: string, members: PartyMember[]) => {
    setParties((prev) => prev.map((p) => (p.id === id ? { ...p, members } : p)));
    if (!user || !isUuid(id)) return;
    void (async () => {
      const { error: deleteError } = await supabase.from("party_members").delete().eq("party_id", id);
      if (deleteError) {
        console.warn("party members delete failed", deleteError.message);
        return;
      }
      const memberRows = members
        .filter((member) => isUuid(member.id))
        .map((member) => ({
          party_id: id,
          profile_id: member.id,
          lat: member.lat,
          lng: member.lng,
          invited_by: user.id,
        }));
      if (memberRows.length) {
        const { error } = await supabase.from("party_members").upsert(memberRows);
        if (error) console.warn("party members update failed", error.message);
      }
    })();
  }, [user]);

  const updateProfileLocation = useCallback(
    async (locationName: string) => {
      const nextLocation = locationName.trim();
      if (!nextLocation) return;

      setCurrentUser((prev) => ({ ...prev, location: nextLocation }));

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ home_location_name: nextLocation })
          .eq("id", user.id);
        if (error) {
          console.warn("profile location update failed", error.message);
        }
      }
    },
    [user],
  );

  const value = useMemo<AppContextType>(
    () => ({
      currentUser,
      posts,
      comments,
      parties,
      groups,
      mapFriends,
      setMapFriends,
      localMessages,
      addLocalMessage,
      markThreadRead,
      refreshSocialThreads,
      refreshPosts,
      addPost,
      deletePost,
      reportPost,
      toggleLike,
      addComment,
      getCommentsForPost,
      getPostById,
      updateProfileLocation,
      createGroup,
      deleteGroup,
      updateGroupMembers,
      createParty,
      deleteParty,
      updatePartyMembers,
    }),
    [
      currentUser,
      posts,
      comments,
      parties,
      groups,
      mapFriends,
      setMapFriends,
      localMessages,
      addLocalMessage,
      markThreadRead,
      refreshSocialThreads,
      refreshPosts,
      addPost,
      deletePost,
      reportPost,
      toggleLike,
      addComment,
      getCommentsForPost,
      getPostById,
      updateProfileLocation,
      createGroup,
      deleteGroup,
      updateGroupMembers,
      createParty,
      deleteParty,
      updatePartyMembers,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
