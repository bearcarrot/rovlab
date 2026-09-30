import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface PatchInfo {
  id: string;
  code: string;
  releasedAt: string | null;
}

let cached: Promise<PatchInfo | null> | null = null;

// Latest patch by released_at. Cached for the session; a failed lookup is not cached.
export function getLatestPatch(): Promise<PatchInfo | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!cached) {
    cached = (async () => {
      const { data, error } = await supabase
        .from("patches")
        .select("id, code, released_at")
        .order("released_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        cached = null;
        return null;
      }
      return { id: data.id as string, code: data.code as string, releasedAt: (data.released_at as string | null) ?? null };
    })();
  }
  return cached;
}
