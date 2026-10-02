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

const SYSTEM =
  "คุณเป็นโค้ช RoV (Arena of Valor) ตอบภาษาไทย กระชับ ตรงประเด็น อ้างอิงจากข้อมูลที่ให้มาเท่านั้น";

// ภาษาไทยกินโทเคนเยอะ และโมเดลแบบ thinking นับโทเคนที่คิดรวมในเพดานนี้ด้วย
// 2048 ทำให้คำตอบยาวๆ ถูกตัดกลางประโยค (finishReason = MAX_TOKENS)
const MAX_OUTPUT_TOKENS = 8192;

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

    const text = context
      ? `${prompt}\n\nข้อมูล:\n${JSON.stringify(context).slice(0, 8000)}`
      : prompt;
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: MAX_OUTPUT_TOKENS },
    });

    // Retry once on overload (500/503/504), then fall back to the next model.
    // 429 goes straight to the fallback (separate quota); 400/403 stop (key/request problem).
    let res: Response | null = null;
    let used = primary;
    outer: for (const m of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await callGemini(m, key, payload);
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
      if (status === 429) return json({ error: "โควต้า AI เต็ม ลองใหม่ภายหลัง" }, 429);
      if (RETRYABLE.has(status)) return json({ error: "Gemini กำลังมีคนใช้เยอะ ลองใหม่อีกครั้งในสักครู่" }, 503);
      let msg = "";
      try { msg = JSON.parse(raw)?.error?.message ?? ""; } catch { /* not json */ }
      return json({ error: `AI error (${status}, model=${used}): ${msg}`.slice(0, 300) }, 502);
    }

    if (used !== primary) console.log("ai-coach used fallback model", used);

    const data = await res.json();
    const out = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!out) {
      const reason = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown";
      console.error("Gemini empty output", reason);
      return json({ error: `AI ไม่ตอบ (${reason})` }, 502);
    }
    // ถ้ายังถูกตัดอยู่ จะเห็นใน log ของ function (จะได้รู้ว่าต้องปรับเพดาน/prompt ต่อ)
    const finish = data.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.warn("ai-coach finishReason", finish, used, data.usageMetadata);
    return json({ text: out });
  } catch (e) {
    console.error("ai-coach exception", e);
    return json({ error: "bad request" }, 400);
  }
});
