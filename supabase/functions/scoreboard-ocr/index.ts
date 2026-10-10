import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// scoreboard-ocr
// Reads a post-match scoreboard screenshot (RoV "ประวัติการเล่น" page) with Gemini vision and returns
// structured data for the client to REVIEW. This function never stores the image and never writes
// match_results: the client inserts the confirmed row itself (RLS: own rows only).
// Quota (cooldown + per-user + global, per day) is enforced atomically by consume_ocr_quota().
//
// Secrets: GEMINI_API_KEY (shared with ai-coach/avatar), GEMINI_OCR_MODEL (default gemini-3.1-flash-lite),
// optional GEMINI_OCR_FALLBACK_MODEL, OCR_USER_DAILY_LIMIT (default 5), OCR_GLOBAL_DAILY_LIMIT (default 400),
// OCR_COOLDOWN_SECONDS (default 8).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const MAX_BYTES = 1_500_000; // decoded size of the client-resized JPEG
const RETRYABLE = new Set([500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanModel = (m: string) => m.trim().replace(/^models\//, "");
const intEnv = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const PROMPT =
  "This image should be the post-match scoreboard of the mobile game Arena of Valor (RoV). " +
  "If it is NOT such a scoreboard, set is_scoreboard=false and fill every other field with defaults. " +
  "Otherwise extract exactly what is printed. Do not guess; do not infer. " +
  "result: \"victory\" or \"defeat\" from the big banner at the top. " +
  "score_blue / score_red: the two big numbers beside the banner (left = blue team, right = red team). " +
  "duration: the mm:ss value next to the clock icon at the top right. played_at: the date and time after it, as YYYY-MM-DD HH:MM. " +
  "players: 10 rows, blue team (left) top to bottom, then red team (right) top to bottom. " +
  "hero = the English hero name written on the portrait; player_name = the nickname printed on the row; " +
  "kills/deaths/assists = the three numbers before the last number; gold = the last number in that group; " +
  "rating = the decimal number beside the portrait; mvp = true only if an MVP badge is on that portrait. " +
  "is_me = true only for the single blue-team row whose background bar is clearly brighter than the others; " +
  "false for all others, and false for every row if you are unsure.";

const PLAYER_SCHEMA = {
  type: "OBJECT",
  properties: {
    team: { type: "STRING", enum: ["blue", "red"] },
    hero: { type: "STRING" },
    player_name: { type: "STRING" },
    kills: { type: "INTEGER" },
    deaths: { type: "INTEGER" },
    assists: { type: "INTEGER" },
    gold: { type: "INTEGER" },
    rating: { type: "NUMBER" },
    mvp: { type: "BOOLEAN" },
    is_me: { type: "BOOLEAN" },
  },
  required: ["team", "hero", "player_name", "kills", "deaths", "assists", "gold", "rating", "mvp", "is_me"],
};
const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_scoreboard: { type: "BOOLEAN" },
    result: { type: "STRING", enum: ["victory", "defeat", "unknown"] },
    score_blue: { type: "INTEGER" },
    score_red: { type: "INTEGER" },
    duration: { type: "STRING" },
    played_at: { type: "STRING" },
    players: { type: "ARRAY", items: PLAYER_SCHEMA },
  },
  required: ["is_scoreboard", "result", "score_blue", "score_red", "duration", "played_at", "players"],
};

function sniffMime(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length > 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  ) return "image/webp";
  return null;
}

// ---------- Gemini ----------
// deno-lint-ignore no-explicit-any
type GeminiOut = { status: number; data: any };

async function callGemini(b64: string, mime: string, key: string, models: string[]): Promise<GeminiOut> {
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: b64 } }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  });

  let last = 0;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload },
      );
      if (res.ok) return { status: 200, data: await res.json() };
      last = res.status;
      console.error("scoreboard-ocr gemini", m, res.status, (await res.text()).slice(0, 300));
      if (RETRYABLE.has(res.status) && attempt === 0) {
        await sleep(800);
        continue;
      }
      break;
    }
    if (last === 400 || last === 403) break; // bad request / key problem: another model will not help
  }
  return { status: last, data: null };
}

// ---------- sanitising model output ----------
type Team = "blue" | "red";
interface Player {
  team: Team;
  hero: string;
  playerName: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  rating: number;
  mvp: boolean;
  isMe: boolean;
}

const int = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// deno-lint-ignore no-explicit-any
function sanitize(raw: any) {
  const players: Player[] = (Array.isArray(raw.players) ? raw.players : []).slice(0, 10).map(
    // deno-lint-ignore no-explicit-any
    (p: any, i: number): Player => ({
      team: p?.team === "red" || p?.team === "blue" ? p.team : i < 5 ? "blue" : "red",
      hero: str(p?.hero, 40),
      playerName: str(p?.player_name, 40),
      kills: int(p?.kills, 200),
      deaths: int(p?.deaths, 200),
      assists: int(p?.assists, 300),
      gold: int(p?.gold, 100000),
      rating: Math.min(Math.max(Math.round(Number(p?.rating) * 10) / 10 || 0, 0), 30),
      mvp: p?.mvp === true,
      isMe: p?.is_me === true,
    }),
  );
  const duration = str(raw.duration, 8);
  const playedAt = str(raw.played_at, 20).replace(/\//g, "-");
  return {
    result: raw.result === "victory" || raw.result === "defeat" ? raw.result : null,
    scoreBlue: int(raw.score_blue, 200),
    scoreRed: int(raw.score_red, 200),
    duration: /^\d{1,3}:[0-5]\d$/.test(duration) ? duration : "",
    playedAt: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(playedAt) ? playedAt : "",
    players,
  };
}

// "BEARCARRØT" must match "bearcarrot": strip diacritics, fold ø, drop punctuation/spaces.
const normName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/[^\p{L}\p{N}]/gu, "");

type MeSource = "name" | "highlight" | null;

// Priority: in-game name from the profile (blue team only) > the brighter bar the model saw > nothing (user picks).
function pickMe(players: Player[], gameName: string | null): MeSource {
  const highlighted = players.filter((p) => p.isMe).length;
  const g = gameName ? normName(gameName) : "";
  if (g.length >= 3) {
    const hits = players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        if (p.team !== "blue") return false;
        const n = normName(p.playerName);
        return n.length >= 3 && (n === g || (n.length >= 4 && g.length >= 4 && (n.includes(g) || g.includes(n))));
      });
    if (hits.length === 1) {
      players.forEach((p, i) => (p.isMe = i === hits[0].i));
      return "name";
    }
  }
  if (highlighted === 1 && players.find((p) => p.isMe)?.team === "blue") return "highlight";
  players.forEach((p) => (p.isMe = false));
  return null;
}

const thaiTime = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Require a real signed-in user
  const sb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (typeof body.image !== "string") return json({ error: "bad request" }, 400);

  const b64 = body.image.replace(/^data:[^;]+;base64,/, "");
  if (b64.length > MAX_BYTES * 1.4) return json({ error: "รูปใหญ่เกินไป" }, 413);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return json({ error: "รูปไม่ถูกต้อง" }, 400);
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return json({ error: "รูปใหญ่เกินไป" }, 413);
  const mime = sniffMime(bytes);
  if (!mime) return json({ error: "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP" }, 415);

  const key = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!key) return json({ error: "ระบบอ่านรูปยังไม่พร้อมใช้งาน" }, 500);
  const primary = cleanModel(Deno.env.get("GEMINI_OCR_MODEL") ?? "gemini-3.1-flash-lite");
  const fallbackRaw = Deno.env.get("GEMINI_OCR_FALLBACK_MODEL");
  const fallback = fallbackRaw ? cleanModel(fallbackRaw) : "";
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // Count the scan first (atomic). Refunded below only when Gemini itself failed.
  const { data: q, error: qErr } = await admin.rpc("consume_ocr_quota", {
    p_user: user.id,
    p_user_limit: intEnv("OCR_USER_DAILY_LIMIT", 5),
    p_global_limit: intEnv("OCR_GLOBAL_DAILY_LIMIT", 400),
    p_cooldown_seconds: intEnv("OCR_COOLDOWN_SECONDS", 8),
  });
  if (qErr || !q) {
    console.error("consume_ocr_quota failed", qErr?.message);
    return json({ error: "ตรวจสอบโควต้าไม่สำเร็จ ลองใหม่อีกครั้ง" }, 500);
  }
  const resetsAt = String(q.resets_at);
  if (q.status === "cooldown") return json({ error: "ส่งรูปถี่เกินไป รอสักครู่แล้วลองใหม่", code: "cooldown" }, 429);
  if (q.status === "user_limit") {
    return json(
      { error: `วันนี้อ่านรูปครบจำนวนที่กำหนดแล้ว ใช้ได้อีกครั้งหลัง ${thaiTime(resetsAt)} น. (เวลาไทย)`, code: "user_limit", resetsAt },
      429,
    );
  }
  if (q.status === "global_limit") {
    return json(
      { error: `โควต้าอ่านรูปของระบบวันนี้เต็มแล้ว ลองใหม่หลัง ${thaiTime(resetsAt)} น. (เวลาไทย)`, code: "global_limit", resetsAt },
      429,
    );
  }
  if (q.status !== "ok") return json({ error: "ตรวจสอบโควต้าไม่สำเร็จ" }, 500);

  const out = await callGemini(b64, mime, key, models);
  if (!out.data) {
    await admin.rpc("refund_ocr_quota", { p_user: user.id });
    return out.status === 429
      ? json({ error: "ระบบอ่านรูปกำลังมีคนใช้เยอะ ลองใหม่ในอีกสักครู่", code: "busy" }, 503)
      : json({ error: "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้งในสักครู่", code: "unavailable" }, 503);
  }

  const data = out.data;
  const cand = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || !cand) {
    return json({ error: "อ่านรูปนี้ไม่ได้ ลองใช้รูปอื่น", code: "unreadable" }, 422);
  }
  const text = (cand.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  // deno-lint-ignore no-explicit-any
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    console.error("scoreboard-ocr: unparsable output", text.slice(0, 200));
    return json({ error: "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง", code: "unparsable" }, 502);
  }
  if (raw?.is_scoreboard !== true) {
    return json({ error: "รูปนี้ไม่ใช่หน้าสรุปผลการเล่นของ RoV", code: "not_scoreboard" }, 422);
  }

  const scan = sanitize(raw);
  const { data: prof } = await admin.from("profiles").select("game_name").eq("id", user.id).maybeSingle();
  const meSource = pickMe(scan.players, (prof?.game_name as string | null | undefined) ?? null);

  return json({ scan, meSource, remaining: Number(q.user_remaining ?? 0), resetsAt });
});
