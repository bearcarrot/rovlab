import { useSyncExternalStore } from "react";

// Global stats-bucket toggle. Matches hero_stats.rank_tier values.
// "high" = Commander and above (in-game definition); "all" = every rank.
export type RankBucket = "all" | "high";

export const RANK_LABEL: Record<RankBucket, string> = {
  all: "ทุกแรงก์",
  high: "Commander ขึ้นไป",
};

const STORAGE_KEY = "rovlab.rank";

function isRank(v: unknown): v is RankBucket {
  return v === "all" || v === "high";
}

// Priority: ?rank=high in the URL (shareable link) > last choice in localStorage > "all".
function initialRank(): RankBucket {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("rank");
    if (isRank(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isRank(stored)) return stored;
  } catch {
    // storage/URL unavailable — fall through to default
  }
  return "all";
}

let current: RankBucket = initialRank();
const listeners = new Set<() => void>();

export function getRank(): RankBucket {
  return current;
}

export function setRank(next: RankBucket) {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRank(): RankBucket {
  return useSyncExternalStore(subscribe, getRank, getRank);
}
