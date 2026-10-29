import type { MatchRecord } from "@/types/match";

// In-memory copy of the signed-in user's newest saved matches, shared by every page that lists them (the Home card asks for 20,
// the Matches page for 100). Each visit used to download up to 100 rows again, every row carrying the 10-player `players` JSON.
// Memory only (gone on reload) and never shared between users. This device's own save/delete patch the copy, so the refetch
// that follows them is answered from memory. A change made on another device shows up when the copy expires (MATCH_LIST_TTL_MS).
// Pure on purpose (no Supabase import) so node:test can load it.

export const MATCH_LIST_TTL_MS = 5 * 60_000;

interface Entry {
  userId: string;
  limit: number;
  at: number;
  rows: MatchRecord[];
}

const newestFirst = (a: MatchRecord, b: MatchRecord) => b.playedAt.localeCompare(a.playedAt);

export function createMatchListCache(ttlMs = MATCH_LIST_TTL_MS, now: () => number = Date.now) {
  let entry: Entry | null = null;
  let gen = 0; // bumped by every local change, so an answer that was already on its way is not stored over it

  /** The entry for this user while it is fresh. Anything else (expired, or another user's) is dropped. */
  const live = (userId: string): Entry | null => {
    if (entry && (entry.userId !== userId || now() - entry.at >= ttlMs)) entry = null;
    return entry;
  };

  return {
    /** The newest `limit` matches, or null when they have to be fetched. */
    get(userId: string, limit: number): MatchRecord[] | null {
      const e = live(userId);
      if (!e) return null;
      // Fewer rows than were asked for means that was every match the user has, so any limit can be answered from it.
      if (limit > e.limit && e.rows.length >= e.limit) return null;
      return e.rows.slice(0, limit);
    },
    /** Call before the request and pass the result to put(). */
    begin(): number {
      return gen;
    },
    put(userId: string, limit: number, rows: MatchRecord[], startedAt: number): void {
      if (startedAt !== gen) return; // a save/delete happened while the request was running: this answer may be stale
      entry = { userId, limit, at: now(), rows: [...rows] };
    },
    /** A match this device just saved. Does not extend the lifetime of the copy. */
    add(userId: string, rec: MatchRecord): void {
      gen++;
      const e = live(userId);
      if (!e) return;
      entry = { ...e, rows: [rec, ...e.rows.filter((r) => r.id !== rec.id)].sort(newestFirst).slice(0, e.limit) };
    },
    /** A match this device just deleted. */
    remove(userId: string, id: string): void {
      gen++;
      const e = live(userId);
      if (!e) return;
      // A full list may hide older matches that would now move up: forget it rather than show one match too few.
      entry = e.rows.length >= e.limit ? null : { ...e, rows: e.rows.filter((r) => r.id !== id) };
    },
    clear(): void {
      gen++;
      entry = null;
    },
  };
}

export type MatchListCache = ReturnType<typeof createMatchListCache>;
