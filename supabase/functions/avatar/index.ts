import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { r2Fetch, type R2Config } from "../_shared/r2.ts";
import { avatarKey, avatarPublicUrl, ownAvatarKey } from "../_shared/avatarKey.ts";

// Avatar upload with moderation.
// Clients cannot write avatars or profiles.avatar_url directly (no storage access +
// column-level UPDATE revoked), so every avatar goes through this function:
//   validate (size + magic bytes) -> Gemini vision moderation (fail closed) -> store in Cloudflare R2 -> update profile.
// R2 credentials are Supabase function secrets (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
// R2_PUBLIC_BASE_URL); see docs/r2-uploads.md.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const MAX_BYTES = 500_000; // decoded size
const COOLDOWN_MS = 20_000;
const RETRYABLE = new Set([500, 503, 504]);
const BLOCKED_FINISH = new Set(["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanModel = (m: string) => m.trim().replace(/^models\//, "");

const MODERATION_PROMPT =
  "You are a content moderator for PUBLIC profile pictures in a mobile-game community app whose users include teenagers. " +
  "Decide whether this image is acceptable as a public avatar. " +
  "REJECT (safe=false) if it shows or contains: nudity or sexual / sexually suggestive content; graphic violence, gore or self-harm; " +
  "hate symbols or extremist imagery; illegal drugs; harassment or bullying; profane or hateful text; " +
  "or a minor in any inappropriate context. " +
  "Game art, anime or cartoon characters, memes, pets, landscapes and ordinary photos are fine. " +
  "Answer with JSON only. Use category \"ok\" when safe, otherwise the best matching category.";

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

type Verdict = { ok: true } | { ok: false; reason: "rejected" | "unavailable" };

async function moderate(b64: string, mime: string, key: string, models: string[]): Promise<Verdict> {
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: MODERATION_PROMPT }, { inlineData: { mimeType: mime, data: b64 } }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          safe: { type: "BOOLEAN" },
          category: { type: "STRING", enum: ["ok", "sexual", "violence", "hate", "drugs", "harassment", "other"] },
        },
        required: ["safe", "category"],
      },
    },
  });

  let res: Response | null = null;
  outer: for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload },
      );
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
    console.error("moderation unavailable", res?.status, res ? (await res.text()).slice(0, 300) : "");
    return { ok: false, reason: "unavailable" };
  }

  const data = await res.json();
  // Blocked by Gemini's own safety filters => treat as rejected.
  if (data.promptFeedback?.blockReason) return { ok: false, reason: "rejected" };
  const cand = data.candidates?.[0];
  if (!cand) return { ok: false, reason: "unavailable" };
  if (cand.finishReason && BLOCKED_FINISH.has(cand.finishReason)) return { ok: false, reason: "rejected" };

  const text = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  try {
    const v = JSON.parse(text);
    // Fail closed: only an explicit safe=true with category "ok" passes.
    return v.safe === true && v.category === "ok" ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    console.error("moderation: unparsable output", text.slice(0, 200));
    return { ok: false, reason: "unavailable" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Require a real signed-in user
  const sb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { action?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // Cloudflare R2 (server-side secrets only). Missing config => uploads fail fast, removals just skip the object delete.
  const env = (k: string) => Deno.env.get(k)?.trim() ?? "";
  const r2: R2Config = {
    accountId: env("R2_ACCOUNT_ID"),
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    bucket: env("R2_BUCKET_NAME"),
  };
  const publicBase = env("R2_PUBLIC_BASE_URL");
  const r2Ready = !!(r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket && publicBase);
  const r2Delete = async (key: string) => {
    try {
      const res = await r2Fetch(r2, "DELETE", key);
      if (!res.ok) console.error("avatar r2 delete failed", res.status);
    } catch (e) {
      console.error("avatar r2 delete error", e instanceof Error ? e.message : "unknown");
    }
  };

  const { data: prof } = await admin
    .from("profiles")
    .select("avatar_url, avatar_updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof) return json({ error: "ไม่พบโปรไฟล์" }, 404);

  // Deletes only the caller's OWN current R2 avatar. Google photos, legacy Supabase Storage URLs and anything
  // under another user's folder give null here and are never deleted.
  async function removeOld() {
    const key = r2Ready ? ownAvatarKey(prof?.avatar_url as string | null | undefined, user!.id, publicBase) : null;
    if (key) await r2Delete(key);
  }

  if (body.action === "remove") {
    const { error } = await admin
      .from("profiles")
      .update({ avatar_url: null, avatar_updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return json({ error: "ลบรูปไม่สำเร็จ" }, 500);
    await removeOld();
    return json({ avatarUrl: null });
  }

  if (body.action !== "upload" || typeof body.image !== "string") return json({ error: "bad request" }, 400);

  // Fail before spending moderation quota or the cooldown when storage is not configured.
  if (!r2Ready) {
    console.error("avatar: missing R2_* secrets");
    return json({ error: "ระบบอัปโหลดรูปยังไม่พร้อมใช้งาน" }, 500);
  }

  // Cooldown counts every attempt (not only successes) so rejected uploads can't be used to burn AI quota.
  if (prof.avatar_updated_at && Date.now() - new Date(prof.avatar_updated_at as string).getTime() < COOLDOWN_MS) {
    return json({ error: "อัปโหลดถี่เกินไป รอสักครู่แล้วลองใหม่" }, 429);
  }

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
  const primaryRaw = Deno.env.get("GEMINI_MODEL");
  if (!key || !primaryRaw) return json({ error: "ระบบตรวจรูปยังไม่พร้อมใช้งาน" }, 500);
  const primary = cleanModel(primaryRaw);
  const fallback = cleanModel(Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.5-flash-lite");
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

  await admin.from("profiles").update({ avatar_updated_at: new Date().toISOString() }).eq("id", user.id);

  const verdict = await moderate(b64, mime, key, models);
  if (!verdict.ok) {
    return verdict.reason === "rejected"
      ? json({ error: "รูปนี้ไม่ผ่านการตรวจสอบ กรุณาเลือกรูปอื่น", code: "rejected" }, 422)
      : json({ error: "ตรวจสอบรูปไม่สำเร็จ ลองใหม่อีกครั้งในสักครู่", code: "unavailable" }, 503);
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = avatarKey(user.id, Date.now(), ext); // always avatars/<caller's id>/<ts>.<ext>
  let put: Response;
  try {
    put = await r2Fetch(r2, "PUT", path, {
      body: bytes,
      headers: {
        "content-type": mime,
        "cache-control": "public, max-age=31536000, immutable",
        "if-none-match": "*", // never overwrite an existing object
      },
    });
  } catch (e) {
    console.error("avatar upload error", e instanceof Error ? e.message : "unknown");
    return json({ error: "อัปโหลดรูปไม่สำเร็จ" }, 500);
  }
  if (!put.ok) {
    console.error("avatar upload failed", put.status);
    return json({ error: "อัปโหลดรูปไม่สำเร็จ" }, 500);
  }

  const avatarUrl = avatarPublicUrl(publicBase, path);
  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (dbErr) {
    console.error("avatar profile update failed", dbErr.message);
    await r2Delete(path); // the new object is unreferenced; the previous avatar is untouched
    return json({ error: "บันทึกรูปไม่สำเร็จ" }, 500);
  }

  await removeOld();
  return json({ avatarUrl });
});
