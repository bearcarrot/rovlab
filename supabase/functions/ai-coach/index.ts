import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SYSTEM = [
  "คุณเป็นโค้ช RoV (Arena of Valor) ตอบภาษาไทย กระชับ ตรงประเด็น อ้างอิงจากข้อมูลที่ให้มาเท่านั้น",
  "กติกา:",
  "1) ถ้า stat เป็น null แปลว่ายังไม่มีสถิติจริง ห้ามอ้าง Tier หรือ Win Rate",
  "2) ข้อความเรื่องแนวหน้า/CC/ดาเมจใน reasons และ teamProfile เป็นการประเมินคร่าวๆ ตามบทบาท (heuristic) ไม่ใช่ข้อมูลยืนยัน ให้ใช้น้ำเสียงเป็นคำแนะนำ",
  "3) พูดถึงได้เฉพาะฮีโร่ที่อยู่ในข้อมูลที่ให้มา ห้ามอ้างฮีโร่อื่น",
  "4) ถ้าข้อมูลส่วนไหนไม่พอ ให้บอกตรงๆ ว่ายังไม่มีข้อมูล แทนการเดา",
  "5) ถ้าท้ายข้อมูลมีหมายเหตุว่าข้อมูลถูกตัด ให้บอกผู้ใช้สั้นๆ ว่าข้อมูลบางส่วนไม่ครบ และอย่าสรุปเรื่องส่วนที่ขาด",
  "ถ้าข้อมูลมีฟิลด์ build (บิลด์แนะนำของฮีโร่จากฐานข้อมูล RoV LAB):",
  "6) ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝงใน build คือข้อเท็จจริงจากฐานข้อมูล ห้ามเพิ่ม ลบ หรือเปลี่ยนชื่อ ห้ามแต่ง id หรือชื่อไอเทมที่ไม่มีใน build.items ชื่อไอเทม รูน พลังแฝง และสกิลชาเลนเจอร์ต้องเขียนเป็นภาษาอังกฤษตามที่อยู่ใน build เป๊ะๆ (ตรงกับในเกม) ห้ามแปลเป็นไทย ส่วนคำอธิบายอื่นตอบเป็นภาษาไทยได้",
  '7) แยกคำตอบให้ชัดว่า "ข้อมูลในระบบ" (อ้างจาก build) ต่างจาก "คำแนะนำจาก AI" (การวิเคราะห์เชิงกลยุทธ์ของคุณ ขึ้นกับสถานการณ์เกม)',
  "8) ถ้า build.patchIsLatest เป็น false ให้บอกสั้นๆ ว่าบิลด์อ้างอิงแพตช์เก่ากว่าปัจจุบัน และห้ามเรียกว่าเมต้าล่าสุด",
  "9) ถ้า build.available เป็น false แปลว่าไม่มีบิลด์ในระบบ ให้บอกตรงๆ และห้ามเสนอรายการไอเทมเป็นบิลด์",
  "10) การปรับไอเทมตามสถานการณ์ให้เลือกจาก build.items (โดยเฉพาะ phase = situational) ถ้าจำเป็นต้องเสนอสิ่งที่ไม่อยู่ใน build ให้เสนอเป็นประเภท เช่น ต้านเวท ไม่ระบุชื่อไอเทม",
].join("\n");

// เพดานขนาด context (ตัวอักษรของ JSON) ฝั่ง client เผื่อไว้ที่ 7200 (ดู coachContext.ts)
const CONTEXT_LIMIT = 8000;

// ภาษาไทยกินโทเคนเยอะ และโมเดลแบบ thinking นับโทเคนที่คิดรวมในเพดานนี้ด้วย
// 2048 ทำให้คำตอบยาวๆ ถูกตัดกลางประโยค (finishReason = MAX_TOKENS)
const MAX_OUTPUT_TOKENS = 8192;

// ต่ำลงเพื่อให้ยึดข้อมูลที่ส่งไป (เดิม 0.7)
const TEMPERATURE = 0.3;

// จำกัดจำนวนครั้งต่อผู้ใช้ต่อวัน (UTC) กัน account เดียวใช้โควต้า Gemini หมด (RPC consume_ai_quota, migration 20261006_ai_coach_daily_quota)
const DAILY_LIMIT = 20;

const RETRYABLE = new Set([500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanModel = (m: string) => m.trim().replace(/^models\//, "");

function callGemini(model: string, key: string, payload: string) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: payload,
    },
  );
}

// ---- ตรวจว่า AI ไม่อ้างฮีโร่ที่ไม่อยู่ในข้อมูลที่ส่งไป ----
// ดึงรายชื่อฮีโร่ทั้งหมดจาก DB (cache 10 นาที) ถ้าดึงไม่ได้ให้ข้ามการตรวจ (fail open)
let nameCache: { at: number; names: string[] } | null = null;
const NAME_TTL_MS = 10 * 60 * 1000;

// deno-lint-ignore no-explicit-any
async function loadHeroNames(sb: { from: (t: string) => any }): Promise<string[]> {
  if (nameCache && Date.now() - nameCache.at < NAME_TTL_MS) return nameCache.names;
  try {
    const { data, error } = await sb.from("heroes").select("name, name_th");
    if (error || !data) return nameCache?.names ?? [];
    const set = new Set<string>();
    for (const r of data as { name?: string; name_th?: string }[]) {
      for (const n of [r.name, r.name_th]) if (typeof n === "string" && n.trim()) set.add(n.trim());
    }
    nameCache = { at: Date.now(), names: [...set] };
    return nameCache.names;
  } catch {
    return nameCache?.names ?? [];
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isLatin = (s: string) => /^[\x20-\x7E]+$/.test(s);

// คืนชื่อฮีโร่ที่ปรากฏในคำตอบ แต่ไม่ได้อยู่ในข้อมูลที่ส่งให้ AI (haystack)
function findUnknownHeroes(answer: string, names: string[], haystack: string): string[] {
  const found: string[] = [];
  for (const name of names) {
    if (name.length < 3 || haystack.includes(name)) continue;
    const hit = isLatin(name)
      ? new RegExp(`(?<![A-Za-z0-9])${escapeRe(name)}(?![A-Za-z0-9])`).test(answer)
      : name.length >= 4 && answer.includes(name);
    if (hit) found.push(name);
  }
  return found;
}

// ---- ตรวจว่า AI ไม่อ้างชื่อไอเทมที่ไม่อยู่ในข้อมูลที่ส่งไป (ใช้เฉพาะเมื่อ context มี build.items) ----
// ข้ามชื่อสั้น (ไทย < 6 ตัว, อังกฤษ < 5 ตัว) เพราะซ้ำกับคำทั่วไปง่าย; ดึงชื่อไม่ได้ = ข้ามการตรวจ (fail open)
let itemNameCache: { at: number; names: string[] } | null = null;

// deno-lint-ignore no-explicit-any
async function loadItemNames(sb: { from: (t: string) => any }): Promise<string[]> {
  if (itemNameCache && Date.now() - itemNameCache.at < NAME_TTL_MS) return itemNameCache.names;
  try {
    const { data, error } = await sb.from("items").select("name, name_th");
    if (error || !data) return itemNameCache?.names ?? [];
    const set = new Set<string>();
    for (const r of data as { name?: string; name_th?: string }[]) {
      for (const n of [r.name, r.name_th]) {
        if (typeof n !== "string") continue;
        const t = n.trim();
        if (t.length >= (isLatin(t) ? 5 : 6)) set.add(t);
      }
    }
    itemNameCache = { at: Date.now(), names: [...set] };
    return itemNameCache.names;
  } catch {
    return itemNameCache?.names ?? [];
  }
}

// คืนชื่อไอเทมที่ปรากฏในคำตอบ แต่ไม่ได้อยู่ในข้อมูลที่ส่งให้ AI (haystack)
function findUnknownItems(answer: string, names: string[], haystack: string): string[] {
  const hay = haystack.toLowerCase();
  const ans = answer.toLowerCase();
  const found: string[] = [];
  for (const name of names) {
    const n = name.toLowerCase();
    if (hay.includes(n)) continue;
    const hit = isLatin(name) ? new RegExp(`(?<![a-z0-9])${escapeRe(n)}(?![a-z0-9])`).test(ans) : ans.includes(n);
    if (hit) found.push(name);
  }
  return found;
}

type GeminiResult =
  | { ok: true; out: string; used: string; primary: string }
  | { ok: false; response: Response };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Require a real signed-in user (the anon key alone is not enough)
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!user.email_confirmed_at) {
    return json({ error: "กรุณายืนยันอีเมลก่อนใช้ AI Coach" }, 403);
  }

  try {
    const { prompt, context } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) {
      return json({ error: "invalid prompt" }, 400);
    }
    // trim: secrets pasted with stray spaces/newlines are a common cause of 400/403
    const key = Deno.env.get("GEMINI_API_KEY")?.trim();
    const primaryRaw = Deno.env.get("GEMINI_MODEL");
    if (!key || !primaryRaw) return json({ error: "AI not configured" }, 500);
    const primary = cleanModel(primaryRaw);
    // optional secret GEMINI_FALLBACK_MODEL; default is a lighter model
    const fallback = cleanModel(Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.5-flash-lite");
    const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

    // Per-user daily quota (service role; the RPC is not callable by clients)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: allowed, error: quotaErr } = await admin.rpc("consume_ai_quota", {
      p_user: user.id,
      p_limit: DAILY_LIMIT,
    });
    if (quotaErr) {
      console.error("ai-coach quota error", quotaErr.message);
      return json({ error: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง" }, 500);
    }
    if (!allowed) {
      return json({ error: `ใช้ AI Coach ครบ ${DAILY_LIMIT} ครั้งต่อวันแล้ว ลองใหม่พรุ่งนี้` }, 429);
    }

    // context ยาวเกินเพดานจะถูกตัดกลางทาง: ใส่หมายเหตุให้โมเดลรู้ว่าข้อมูลไม่ครบ (ไม่งั้นมันจะตอบเหมือนข้อมูลครบ)
    // ฝั่งผู้ใช้เก็บ snapshot ของ context ด้วยการตัดแบบเดียวกัน (slice 8000) เพื่อให้แอดมินตรวจรีวิวย้อนหลังได้ตรงกัน
    let ctxText = context ? JSON.stringify(context) : "";
    if (ctxText.length > CONTEXT_LIMIT) {
      console.warn("ai-coach context truncated", ctxText.length);
      ctxText = ctxText.slice(0, CONTEXT_LIMIT) + `\n[หมายเหตุ: ข้อมูลยาวเกินและถูกตัดท้าย ส่วนที่เหลือไม่ครบ]`;
    }
    const text = ctxText ? `${prompt}\n\nข้อมูล:\n${ctxText}` : prompt;

    // เรียก Gemini หนึ่งรอบ (retry เมื่อ overload แล้วค่อยสลับไปโมเดลสำรอง)
    async function run(userText: string): Promise<GeminiResult> {
      const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: TEMPERATURE, maxOutputTokens: MAX_OUTPUT_TOKENS },
      });

      // Retry once on overload (500/503/504), then fall back to the next model.
      // 429 goes straight to the fallback (separate quota); 400/403 stop (key/request problem).
      let res: Response | null = null;
      let used = primary;
      outer: for (const m of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          res = await callGemini(m, key!, payload);
          used = m;
          if (res.ok) break outer;
          if (RETRYABLE.has(res.status)) {
            if (attempt === 0) await sleep(800);
            continue;
          }
          break;
        }
        if (res && (res.status === 400 || res.status === 403)) break;
      }

      if (!res || !res.ok) {
        const status = res?.status ?? 0;
        const raw = res ? await res.text() : "";
        console.error("Gemini error", status, used, raw.slice(0, 500));
        if (status === 429) return { ok: false, response: json({ error: "โควต้า AI เต็ม ลองใหม่ภายหลัง" }, 429) };
        if (RETRYABLE.has(status)) {
          return { ok: false, response: json({ error: "Gemini กำลังมีคนใช้เยอะ ลองใหม่อีกครั้งในสักครู่" }, 503) };
        }
        // รายละเอียด (โมเดล/ข้อความจาก Google) อยู่ใน log เท่านั้น ไม่ส่งให้ client
        return { ok: false, response: json({ error: `AI ขัดข้องชั่วคราว (${status})` }, 502) };
      }

      if (used !== primary) console.log("ai-coach used fallback model", used);

      const data = await res.json();
      const out = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (!out) {
        const reason = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown";
        console.error("Gemini empty output", reason);
        return { ok: false, response: json({ error: `AI ไม่ตอบ (${reason})` }, 502) };
      }
      // ถ้ายังถูกตัดอยู่ จะเห็นใน log ของ function (จะได้รู้ว่าต้องปรับเพดาน/prompt ต่อ)
      const finish = data.candidates?.[0]?.finishReason;
      if (finish && finish !== "STOP") console.warn("ai-coach finishReason", finish, used, data.usageMetadata);
      return { ok: true, out, used, primary };
    }

    let r = await run(text);
    if (!r.ok) return r.response;
    let out = r.out;

    // ตรวจชื่อฮีโร่ที่ไม่อยู่ในข้อมูล: ลองใหม่ 1 ครั้ง ถ้ายังมั่วอีกให้ปฏิเสธแทนการแสดงคำตอบที่อ้างข้อมูลไม่มีจริง
    const names = await loadHeroNames(sb);
    let unknown = findUnknownHeroes(out, names, text);
    if (unknown.length > 0) {
      console.warn("ai-coach mentioned heroes not in context", unknown);
      r = await run(
        `${text}\n\nหมายเหตุ: คำตอบก่อนหน้าพูดถึงฮีโร่ที่ไม่อยู่ในข้อมูล (${unknown.join(", ")}) ` +
          `ห้ามพูดถึงฮีโร่เหล่านี้ ให้ใช้เฉพาะฮีโร่ที่อยู่ในข้อมูลที่ให้`,
      );
      if (!r.ok) return r.response;
      out = r.out;
      unknown = findUnknownHeroes(out, names, text);
      if (unknown.length > 0) {
        console.warn("ai-coach still mentioned unknown heroes", unknown);
        return json({ error: "AI ตอบอ้างถึงฮีโร่ที่ไม่อยู่ในข้อมูล ลองถามใหม่อีกครั้ง" }, 502);
      }
    }

    // บิลด์แนะนำ: ถ้าคำตอบอ้างไอเทมที่ไม่อยู่ใน build ที่ส่งไป ลองใหม่ 1 ครั้ง ถ้ายังมั่วอีกให้ปฏิเสธ (เหมือนการตรวจชื่อฮีโร่)
    if (Array.isArray(context?.build?.items)) {
      const itemNames = await loadItemNames(sb);
      let badItems = findUnknownItems(out, itemNames, text);
      if (badItems.length > 0) {
        console.warn("ai-coach mentioned items not in context", badItems);
        r = await run(
          `${text}\n\nหมายเหตุ: คำตอบก่อนหน้าพูดถึงไอเทมที่ไม่อยู่ใน build (${badItems.join(", ")}) ` +
            `ห้ามระบุชื่อไอเทมเหล่านี้ ให้ใช้เฉพาะไอเทมใน build.items หรือเสนอเป็นประเภทไอเทมแทน`,
        );
        if (!r.ok) return r.response;
        out = r.out;
        badItems = findUnknownItems(out, itemNames, text);
        if (badItems.length > 0) {
          console.warn("ai-coach still mentioned unknown items", badItems);
          return json({ error: "AI ตอบอ้างถึงไอเทมที่ไม่อยู่ในบิลด์ ลองถามใหม่อีกครั้ง" }, 502);
        }
      }
    }

    return json({ text: out });
  } catch (e) {
    console.error("ai-coach exception", e);
    return json({ error: "bad request" }, 400);
  }
});
