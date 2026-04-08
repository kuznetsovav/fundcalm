import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** True when URL and anon/service key are set (trimmed non-empty). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  return Boolean(url && key);
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Dynamic import to avoid bundling supabase at compile time
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(url, key);
  return client;
}
