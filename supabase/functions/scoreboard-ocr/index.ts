import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// scoreboard-ocr
// Reads 1-3 post-match scoreboard screenshots (RoV "ประวัติการเล่น" page) with Gemini vision in ONE request and returns
// structured data for the client to REVIEW. It never stores images and never writes match_results: the client inserts the
// confirmed rows itself (RLS: own rows only).
// Quota (cooldown + per-user + global, per day) is enforced atomically by consume_ocr_quota(): the per-user limit counts
// images, the global limit counts requests (that is what Gemini's RPD counts).
//
// Body: { images: string[] }  (legacy single-image { image: string } is still accepted and answered in the old shape)
// Secrets: GEMINI_API_KEY, GEMINI_OCR_MODEL (default gemini-3.1-flash-lite), optional GEMINI_OCR_FALLBACK_MODEL,
// OCR_USER_DAILY_LIMIT (5 images), OCR_GLOBAL_DAILY_LIMIT (400 requests), OCR_COOLDOWN_SECONDS (8).
// Every Gemini call logs token usage (see Edge Functions -> scoreboard-ocr -> Logs, line "scoreboard-ocr usage").
// Logs never contain model output, upstream response bodies or image data (player names): only status codes, enum-like
// codes and sizes. tests/security/ocr-logs.test.ts enforces this.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const MAX_IMAGES = 3;
const MAX_BYTES = 1_500_000; // decoded size of ONE client-resized JPEG
const MAX_TOTAL_BYTES = 4_000_000;
const RETRYABLE = new Set([500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanModel = (m: string) => m.trim().replace(/^models\//, "");
const intEnv = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const PROMPT =
  "You receive one or more images, each preceded by a text label \"Image k\". Each should be the post-match scoreboard of the mobile game Arena of Valor (RoV). " +
  "Return exactly one entry in `matches` per image, in order, with image_index = k (1-based). " +
  "Never mix data between images. For each image: " +
  "if it is NOT such a scoreboard, set is_scoreboard=false and fill every other field with defaults. " +
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
const MATCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    image_index: { type: "INTEGER" },
    is_scoreboard: { type: "BOOLEAN" },
    result: { type: "STRING", enum: ["victory", "defeat", "unknown"] },
    score_blue: { type: "INTEGER" },
    score_red: { type: "INTEGER" },
    duration: { type: "STRING" },
    played_at: { type: "STRING" },
    players: { type: "ARRAY", items: PLAYER_SCHEMA },
  },
  required: ["image_index", "is_scoreboard", "result", "score_blue", "score_red", "duration", "played_at", "players"],
};
const SCHEMA = {
  type: "OBJECT",
  properties: { matches: { type: "ARRAY", items: MATCH_SCHEMA } },
  required: ["matches"],
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
type GeminiOut = { status: number; data: any; model: string; ms: number };
type Img = { b64: string; mime: string };

async function callGemini(images: Img[], key: string, models: string[]): Promise<GeminiOut> {
  const parts: unknown[] = [{ text: PROMPT }];
  images.forEach((im, i) => {
    parts.push({ text: `Image ${i + 1}` });
    parts.push({ inlineData: { mimeType: im.mime, data: im.b64 } });
  });
  const payload = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: Math.min(3072 * images.length + 1024, 12288),
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  });

  const started = Date.now();
  let last = 0;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload },
      );
      if (res.ok) return { status: 200, data: await res.json(), model: m, ms: Date.now() - started };
      last = res.status;
      // Only Google's error enum (e.g. INVALID_ARGUMENT), never the message: it can quote the request.
      const code = await res.json().then((j) => j?.error?.status, () => undefined);
      const geminiStatus = typeof code === "string" ? code.slice(0, 40) : "";
      console.error("scoreboard-ocr gemini", m, res.status, geminiStatus);
      if (RETRYABLE.has(res.status) && attempt === 0) {
        await sleep(800);
        continue;
      }
      break;
    }
    if (last === 400 || last === 403) break; // bad request / key problem: another model will not help
  }
  return { status: last, data: null, model: models[0], ms: Date.now() - started };
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

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Require a real signed-in user
  const sb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { images?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const legacy = typeof body.image === "string" && body.images === undefined;
  const rawImages: unknown[] = legacy ? [body.image] : Array.isArray(body.images) ? body.images : [];
  if (rawImages.length === 0 || rawImages.some((x) => typeof x !== "string")) return json({ error: "bad request" }, 400);
  if (rawImages.length > MAX_IMAGES) return json({ error: `ส่งได้ครั้งละไม่เกิน ${MAX_IMAGES} รูป` }, 400);

  const images: Img[] = [];
  let total = 0;
  for (const x of rawImages as string[]) {
    const b64 = x.replace(/^data:[^;]+;base64,/, "");
    if (b64.length > MAX_BYTES * 1.4) return json({ error: "รูปใหญ่เกินไป" }, 413);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "รูปไม่ถูกต้อง" }, 400);
    }
    total += bytes.length;
    if (bytes.length === 0 || bytes.length > MAX_BYTES || total > MAX_TOTAL_BYTES) return json({ error: "รูปใหญ่เกินไป" }, 413);
    const mime = sniffMime(bytes);
    if (!mime) return json({ error: "รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP" }, 415);
    images.push({ b64, mime });
  }
  const n = images.length;

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
    p_images: n,
  });
  if (qErr || !q) {
    console.error("consume_ocr_quota failed", qErr?.message);
    return json({ error: "ตรวจสอบโควต้าไม่สำเร็จ ลองใหม่อีกครั้ง" }, 500);
  }
  const resetsAt = String(q.resets_at);
  if (q.status === "cooldown") return json({ error: "ส่งรูปถี่เกินไป รอสักครู่แล้วลองใหม่", code: "cooldown" }, 429);
  if (q.status === "user_limit") {
    return json(
      { error: `โควต้าวิเคราะห์รูปวันนี้ไม่พอสำหรับ ${n} รูป ใช้ได้อีกครั้งหลัง ${thaiTime(resetsAt)} น. (เวลาไทย)`, code: "user_limit", resetsAt },
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

  const out = await callGemini(images, key, models);
  if (!out.data) {
    await admin.rpc("refund_ocr_quota", { p_user: user.id, p_images: n, p_request: true });
    console.log("scoreboard-ocr usage", JSON.stringify({ model: out.model, images: n, ok: false, status: out.status, ms: out.ms }));
    return out.status === 429
      ? json({ error: "ระบบอ่านรูปกำลังมีคนใช้เยอะ ลองใหม่ในอีกสักครู่", code: "busy" }, 503)
      : json({ error: "วิเคราะห์รูปไม่สำเร็จ ลองใหม่อีกครั้งในสักครู่", code: "unavailable" }, 503);
  }

  const data = out.data;
  const u = data.usageMetadata ?? {};
  // token usage for sizing the quota (numbers only, no user data)
  console.log(
    "scoreboard-ocr usage",
    JSON.stringify({
      model: out.model,
      images: n,
      ok: true,
      ms: out.ms,
      promptTokens: num(u.promptTokenCount),
      outputTokens: num(u.candidatesTokenCount),
      thoughtTokens: num(u.thoughtsTokenCount),
      totalTokens: num(u.totalTokenCount),
    }),
  );

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
    // The text holds player names: log only its length and Gemini's finishReason (MAX_TOKENS = cut off), never the text.
    const chars = text.length;
    console.error(
      "scoreboard-ocr: unparsable output",
      JSON.stringify({ model: out.model, finishReason: String(cand.finishReason ?? "").slice(0, 30), chars }),
    );
    return json({ error: "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง", code: "unparsable" }, 502);
  }

  const entries: unknown[] = Array.isArray(raw?.matches) ? raw.matches : [];
  const { data: prof } = await admin.from("profiles").select("game_name").eq("id", user.id).maybeSingle();
  const gameName = (prof?.game_name as string | null | undefined) ?? null;

  type Item =
    | { index: number; ok: true; scan: ReturnType<typeof sanitize>; meSource: MeSource }
    | { index: number; ok: false; code: "not_scoreboard" | "missing"; error: string };
  const results: Item[] = [];
  let missing = 0;
  for (let k = 1; k <= n; k++) {
    // deno-lint-ignore no-explicit-any
    const e: any = entries.find((x: any) => Number(x?.image_index) === k) ?? (entries.length === n ? entries[k - 1] : undefined);
    if (!e) {
      missing++;
      results.push({ index: k, ok: false, code: "missing", error: "วิเคราะห์รูปนี้ไม่สำเร็จ" });
    } else if (e.is_scoreboard !== true) {
      results.push({ index: k, ok: false, code: "not_scoreboard", error: "รูปนี้ไม่ใช่หน้าสรุปผลการเล่นของ RoV" });
    } else {
      const scan = sanitize(e);
      results.push({ index: k, ok: true, scan, meSource: pickMe(scan.players, gameName) });
    }
  }
  // images the model silently dropped were not analysed: give those back (the request itself was spent)
  if (missing > 0) await admin.rpc("refund_ocr_quota", { p_user: user.id, p_images: missing, p_request: false });

  const remaining = Number(q.user_remaining ?? 0) + missing;

  if (legacy) {
    const r = results[0];
    if (r.ok) return json({ scan: r.scan, meSource: r.meSource, remaining, resetsAt });
    return json({ error: r.error, code: r.code }, 422);
  }
  return json({ results, remaining, resetsAt });
});
