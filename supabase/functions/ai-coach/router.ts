// Central model router + bounded fallback plan + response cache for ai-coach.
// Pure TS (no Deno APIs) so it can be unit-tested with `node --test` (tests/coach/router.test.ts).
// The client only sends a Quick Chat id (QuickChat.id); the server decides the model. A client "model" or
// "complex" field is never read. To add a Quick Chat: add its id to LITE_ACTIONS (default) or ROUTES.

export type Tier = "lite" | "flash";
export type Route = { tier: Tier; reason: string };

// deno-lint-ignore no-explicit-any
type Ctx = any;

// Gemini 3.8 Flash has a tiny provider quota (20 RPD) shared by ALL users, so it is only used when the
// server-verified context is genuinely multi-factor. Thresholds are intentionally conservative.
export const FLASH_MIN_DRAFT_HEROES = 4; // draft-eval: heroes picked across both teams
export const FLASH_MIN_PICK_ENEMIES = 3; // pick-*: enemies AND allies both known
export const FLASH_MIN_PICK_ALLIES = 3;

const count = (a: unknown) => (Array.isArray(a) ? a.filter(Boolean).length : 0);

// Routine, single-subject Quick Chats (ids from HeroDetail / CounterPick / Matchup pages).
const LITE_ACTIONS = new Set([
  "how-to-play", "skills", "pros-cons", "who-fits", "game-phase", // HeroDetail
  "build-why", // HeroDetail: explain the given build
  "how-to-face", // CounterPick: one enemy + its counters
  "matchup-plan", // Matchup: 1v1
]);

// Complex Quick Chats: Flash only if `qualifies(context)` holds, otherwise Lite.
const ROUTES: Record<string, { qualifies: (c: Ctx) => boolean; why: string }> = {
  // DraftAssistant "ประเมินดราฟต์": context.mine / context.enemy = hero name or null per slot
  "draft-eval": { qualifies: (c) => count(c?.mine) + count(c?.enemy) >= FLASH_MIN_DRAFT_HEROES, why: "full_draft_analysis" },
  // HeroDetail "ปรับไอเทมตามศัตรู": needs a real DB build to reason over
  "build-situational": {
    qualifies: (c) => c?.build?.available !== false && Array.isArray(c?.build?.items) && c.build.items.length > 0,
    why: "matchup_dependent_build",
  },
  // DraftAssistant "ถามเรื่อง <hero>" (id = pick-<slug>): context.team.{mine,enemy} = hero names
  pick: {
    qualifies: (c) => count(c?.team?.enemy) >= FLASH_MIN_PICK_ENEMIES && count(c?.team?.mine) >= FLASH_MIN_PICK_ALLIES,
    why: "multi_hero_pick_analysis",
  },
};

export const actionKey = (action: unknown): string => {
  if (typeof action !== "string") return "none";
  const a = action.slice(0, 64);
  return a.startsWith("pick-") ? "pick" : a;
};

export function routeRequest(action: unknown, context: Ctx): Route {
  const key = actionKey(action);
  if (key === "none") return { tier: "lite", reason: "no_action_default" };
  const rule = ROUTES[key];
  if (rule) {
    let ok = false;
    try {
      ok = rule.qualifies(context);
    } catch {
      ok = false;
    }
    return ok ? { tier: "flash", reason: rule.why } : { tier: "lite", reason: `${key}_context_below_threshold` };
  }
  return LITE_ACTIONS.has(key) ? { tier: "lite", reason: "routine_action" } : { tier: "lite", reason: "unknown_action_default" };
}

// ---- bounded attempt plan (no loops, no unbounded retries) ----
export type Step = { model: string; tier: Tier; retries: number };

// Flash route: Flash once (no same-model retry: a 429/5xx goes straight to Lite, no sleep before fallback),
// then Lite (1 retry on transient 5xx). Lite route: Lite only (1 retry), never spends Flash quota.
export function attemptPlan(tier: Tier, flashModel: string | null, liteModel: string): Step[] {
  const lite: Step = { model: liteModel, tier: "lite", retries: 1 };
  if (tier === "lite" || !flashModel || flashModel === liteModel) return [lite];
  return [{ model: flashModel, tier: "flash", retries: 0 }, lite];
}

export const RETRYABLE = new Set([500, 503, 504]);
// 400/403 (bad key/request) stop everything; other failures move on to the next step in the plan.
export const stopsAll = (status: number) => status === 400 || status === 403;

// Distinguish Gemini provider quota (code) from RoV LAB per-user quota ("user_quota", set in index.ts).
export const providerErrorCode = (status: number) =>
  status === 429 ? "provider_quota" : RETRYABLE.has(status) ? "provider_overloaded" : "provider_error";

// ---- response cache (per Edge isolate, best effort) ----
export async function cacheKey(parts: string[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("\u0000")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Cacheable = { ok: boolean; cacheable?: boolean };

export class ResponseCache<R extends Cacheable> {
  ttlMs: number;
  max: number;
  store = new Map<string, { r: R; exp: number }>();
  inflight = new Map<string, Promise<R>>();
  constructor(ttlMs: number, max = 200) {
    this.ttlMs = ttlMs;
    this.max = max;
  }
  // Only successful, validated results (ok && cacheable !== false) are stored. Errors are never cached.
  async getOrCompute(key: string, compute: () => Promise<R>, now = Date.now()): Promise<{ result: R; source: "hit" | "miss" | "joined" }> {
    const hit = this.store.get(key);
    if (hit && hit.exp > now) return { result: hit.r, source: "hit" };
    const running = this.inflight.get(key);
    if (running) return { result: await running, source: "joined" };
    const p = compute().then((r) => {
      if (r.ok && r.cacheable !== false) {
        this.store.set(key, { r, exp: Date.now() + this.ttlMs });
        while (this.store.size > this.max) this.store.delete(this.store.keys().next().value as string);
      }
      return r;
    });
    this.inflight.set(key, p);
    try {
      return { result: await p, source: "miss" };
    } finally {
      this.inflight.delete(key);
    }
  }
}
