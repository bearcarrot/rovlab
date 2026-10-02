import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Icons for the role / lane filter chips, kept in the `hero_roles` / `hero_lanes` tables
// (editable in /admin). A missing row or empty icon_url means "no icon" => the chip falls back to text only.
export type FilterIcons = { roles: Record<string, string>; lanes: Record<string, string> };

const EMPTY: FilterIcons = { roles: {}, lanes: {} };

type IconRow = { code: string; icon_url: string | null };

function toMap(rows: IconRow[] | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows ?? []) if (r.icon_url) map[r.code] = r.icon_url;
  return map;
}

let cached: Promise<FilterIcons> | null = null;

async function load(): Promise<FilterIcons> {
  const [roles, lanes] = await Promise.all([
    supabase.from("hero_roles").select("code, icon_url"),
    supabase.from("hero_lanes").select("code, icon_url"),
  ]);
  if (roles.error || lanes.error) throw new Error(roles.error?.message ?? lanes.error?.message);
  return { roles: toMap(roles.data as IconRow[] | null), lanes: toMap(lanes.data as IconRow[] | null) };
}

// Loaded once per session. A failed load is not cached and resolves to "no icons" (text-only chips).
export function getFilterIcons(): Promise<FilterIcons> {
  if (!isSupabaseConfigured) return Promise.resolve(EMPTY);
  if (!cached) {
    const p = load().catch(() => {
      if (cached === p) cached = null;
      return EMPTY;
    });
    cached = p;
  }
  return cached;
}

// Called by /admin after an icon is edited so the next page that renders filters sees the change.
export function clearFilterIconsCache() {
  cached = null;
}
