import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Falls back to a dummy client when env vars are missing so the app can still
// run (auth-gated features show a "not configured" state instead of crashing).
// Fill .env with real values from your Supabase project to activate auth/favorites.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : createClient("https://placeholder.supabase.co", "placeholder-anon-key");
