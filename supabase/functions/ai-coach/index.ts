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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { prompt, context } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) {
      return json({ error: "invalid prompt" }, 400);
    }
    const key = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL");
    if (!key || !model) return json({ error: "AI not configured" }, 500);

    const text = context
      ? `${prompt}\n\nข้อมูล:\n${JSON.stringify(context).slice(0, 8000)}`
      : prompt;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      },
    );
    if (res.status === 429) return json({ error: "โควต้า AI เต็ม ลองใหม่ภายหลัง" }, 429);
    if (!res.ok) return json({ error: "AI error" }, 502);

    const data = await res.json();
    const out = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    return json({ text: out });
  } catch {
    return json({ error: "bad request" }, 400);
  }
});
