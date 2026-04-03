import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  createdAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
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
  addPost: (content: string, location: string, imageUrl?: string) => void;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, content: string) => void;
  getCommentsForPost: (postId: string) => Comment[];
  getPostById: (postId: string) => Post | undefined;
  createParty: (name: string, lat: number, lng: number, members: PartyMember[]) => void;
};

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "localsocial_data";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [comments, setComments] = useState<Comment[]>(SEED_COMMENTS);
  const [parties, setParties] = useState<Party[]>([]);
  const currentUser = ME;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.posts?.length > 0) setPosts(parsed.posts);
        if (parsed.comments?.length > 0) setComments(parsed.comments);
      }
    } catch (_) {}
  };

  const saveData = useCallback(
    async (newPosts: Post[], newComments: Comment[]) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ posts: newPosts, comments: newComments })
        );
      } catch (_) {}
    },
    []
  );

  const addPost = useCallback(
    (content: string, location: string, imageUrl?: string) => {
      const newPost: Post = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        user: currentUser,
        content,
        imageUrl,
        location,
        likesCount: 0,
        commentsCount: 0,
        liked: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newPost, ...posts];
      setPosts(updated);
      saveData(updated, comments);
    },
    [posts, comments, currentUser, saveData]
  );

  const toggleLike = useCallback(
    (postId: string) => {
      const updated = posts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          liked: !p.liked,
          likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1,
        };
      });
      setPosts(updated);
      saveData(updated, comments);
    },
    [posts, comments, saveData]
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

  const createParty = useCallback(
    (name: string, lat: number, lng: number, members: PartyMember[]) => {
      const newParty: Party = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        name,
        lat,
        lng,
        hostId: currentUser.id,
        hostName: currentUser.name,
        members,
        createdAt: new Date().toISOString(),
      };
      setParties((prev) => [...prev, newParty]);
    },
    [currentUser]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        posts,
        comments,
        parties,
        addPost,
        toggleLike,
        addComment,
        getCommentsForPost,
        getPostById,
        createParty,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
