import type { Announcement, Priority } from "./types";

const MAX_SHOWN = 3;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, important: 1, normal: 2 };

// Mirrors the database policy (status + window) so open tabs can re-filter locally between refetches (spec section 6).
export function isVisible(a: Announcement, nowMs: number, dismissed: ReadonlySet<string>): boolean {
  if (a.status !== "published") return false;
  if (a.starts_at !== null && Date.parse(a.starts_at) > nowMs) return false;
  if (a.ends_at !== null && Date.parse(a.ends_at) <= nowMs) return false;
  return !dismissed.has(a.id);
}

function sortKey(a: Announcement): number {
  return Date.parse(a.starts_at ?? a.created_at);
}

export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((x, y) => {
    const p = PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority];
    if (p !== 0) return p;
    const t = sortKey(y) - sortKey(x);
    if (t !== 0) return t;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

export function selectVisible(list: Announcement[], nowMs: number, dismissed: ReadonlySet<string>): { shown: Announcement[]; more: Announcement[] } {
  const sorted = sortAnnouncements(list.filter((a) => isVisible(a, nowMs, dismissed)));
  return { shown: sorted.slice(0, MAX_SHOWN), more: sorted.slice(MAX_SHOWN) };
}
