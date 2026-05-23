import AsyncStorage from "@react-native-async-storage/async-storage";
import { setupURLPolyfill } from "react-native-url-polyfill";
import { createClient } from "@supabase/supabase-js";

setupURLPolyfill();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseAnonKey = "missing-anon-key";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const supabaseFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    console.warn("Supabase network request failed", error);
    return new Response(JSON.stringify({ message: "Supabase network unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const supabase = createClient(
  supabaseUrl ?? fallbackSupabaseUrl,
  supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    global: {
      fetch: supabaseFetch,
    },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
