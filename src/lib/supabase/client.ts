import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      auth: {
        signUp: async () => ({ error: new Error("Supabase not configured") }),
        signInWithPassword: async () => ({
          error: new Error("Supabase not configured"),
        }),
        signInWithOAuth: async () => ({
          error: new Error("Supabase not configured"),
        }),
        signOut: async () => {},
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(url, key);
}
