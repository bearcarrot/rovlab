import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";

export interface PatchInfo {
  id: string;
  code: string;
  releasedAt: string | null;
}

// Latest patch by released_at. Shared by hero_stats / tier lists / Item Build via the ttlCache key "patch:latest"
// (persisted across reloads, admins bypass); a failed or empty lookup is not cached.
export function getLatestPatch(): Promise<PatchInfo | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  return cached(
    "patch:latest",
    CACHE_TTL_MS,
    async () => {
      const { data, error } = await supabase
        .from("patches")
        .select("id, code, released_at")
        .order("released_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return { id: data.id as string, code: data.code as string, releasedAt: (data.released_at as string | null) ?? null };
    },
    (v) => v !== null,
  );
}
