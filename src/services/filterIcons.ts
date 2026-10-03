import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Display data for the role / lane filter chips, kept in the `hero_roles` / `hero_lanes` tables (editable in /admin
// and the Supabase dashboard): label (shown name), sort_order (chip order) and icon_url.
// A missing row falls back to the labels / order hardcoded in HeroFilters.tsx; an empty icon_url means "no icon"
// => the chip falls back to text only.
// (The type keeps its old name so existing imports don't change; it now carries labels and order as well.)
export type FilterIcons = {
  roles: Record<string, string>;
  lanes: Record<string, string>;
  roleLabels: Record<string, string>;
  laneLabels: Record<string, string>;
  /** role codes sorted by sort_order */
  roleOrder: string[];
  /** lane codes sorted by sort_order */
  laneOrder: string[];
};

const EMPTY: FilterIcons = { roles: {}, lanes: {}, roleLabels: {}, laneLabels: {}, roleOrder: [], laneOrder: [] };

type MetaRow = { code: string; label: string | null; sort_order: number | null; icon_url: string | null };

function toMeta(rows: MetaRow[] | null) {
  const icons: Record<string, string> = {};
  const labels: Record<string, string> = {};
  const sorted = [...(rows ?? [])].sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
  for (const r of sorted) {
    if (r.icon_url) icons[r.code] = r.icon_url;
    if (r.label) labels[r.code] = r.label;
  }
  return { icons, labels, order: sorted.map((r) => r.code) };
}

// Sort `items` by the position of `value` in `order`. Codes missing from `order` go last, keeping their original order.
export function sortByOrder<T extends { value: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const pos = (v: string) => {
    const i = order.indexOf(v);
    return i === -1 ? order.length : i;
  };
  return [...items].sort((a, b) => pos(a.value) - pos(b.value));
}

let cached: Promise<FilterIcons> | null = null;

async function load(): Promise<FilterIcons> {
  const [roles, lanes] = await Promise.all([
    supabase.from("hero_roles").select("code, label, sort_order, icon_url"),
    supabase.from("hero_lanes").select("code, label, sort_order, icon_url"),
  ]);
  if (roles.error || lanes.error) throw new Error(roles.error?.message ?? lanes.error?.message);
  const r = toMeta(roles.data as MetaRow[] | null);
  const l = toMeta(lanes.data as MetaRow[] | null);
  return { roles: r.icons, lanes: l.icons, roleLabels: r.labels, laneLabels: l.labels, roleOrder: r.order, laneOrder: l.order };
}

// Loaded once per session. A failed load is not cached and resolves to "no data" (hardcoded labels/order, text-only chips).
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
