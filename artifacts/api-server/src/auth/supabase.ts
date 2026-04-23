import { createClient, type SupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";

import type { User } from "../data/store";

const supabaseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const supabaseKey =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
  process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ??
  process.env["SUPABASE_ANON_KEY"];

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  client ??= createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

function stringFromMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function mapSupabaseUserToAppUser(user: SupabaseUser): User {
  const metadata = user.user_metadata;
  const emailName = user.email?.split("@")[0];
  const name =
    stringFromMetadata(metadata, "display_name") ??
    stringFromMetadata(metadata, "full_name") ??
    stringFromMetadata(metadata, "name") ??
    emailName ??
    "Locals User";
  const username =
    stringFromMetadata(metadata, "username") ??
    emailName?.toLowerCase().replace(/[^a-z0-9_]/g, "") ??
    user.id.slice(0, 8);

  return {
    id: user.id,
    name,
    username,
    avatar:
      stringFromMetadata(metadata, "avatar_url") ??
      `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(user.id)}`,
    bio: stringFromMetadata(metadata, "bio") ?? "",
    location: stringFromMetadata(metadata, "location") ?? "",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  };
}
