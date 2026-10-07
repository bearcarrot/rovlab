import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// game-id: link / refresh / unlink a player's in-game identity (RoV OpenID -> in-game name).
// Clients can never write public.game_identities, so the name cannot be edited by hand; it is only ever set here,
// from what Garena's top-up site (termgame.com) returns for the OpenID.
//
// NOTE: termgame.com's API is internal and unofficial, and it sits behind bot protection (DataDome). This function
// makes plain, honest requests (identifying User-Agent, no retries, no evasion). If the site blocks it, the function
// just reports "unavailable" and nothing is stored.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const APP_ID = 100055; // Garena app id for RoV
const UPSTREAM = "https://termgame.com";
const UA = "RoVLAB/1.0 (+https://rovlab.vercel.app)";
const TIMEOUT_MS = 8000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MAX_LOOKUPS_PER_HOUR = 5; // link + refresh attempts, successful or not
const REFRESH_COOLDOWN_MS = DAY_MS; // one refresh per 24h
const MAX_LINKS_PER_30D = 3; // successful new links per 30 days (stops hopping between other people's IDs)

type Lookup = { ok: true; ign: string; server: string | null } | { ok: false; reason: "not_found" | "unavailable" };

// Strips control, zero-width and bidi-override characters, then caps the length (in code points).
function clean(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g, "")
    .trim();
  const out = Array.from(s).slice(0, max).join("").trim();
  return out || null;
}

async function lookupPlayer(playerId: string): Promise<Lookup> {
  const base = { Accept: "application/json, text/plain, */*", "User-Agent": UA };

  // 1) OpenID -> upstream session / internal open_id
  let login: Response;
  try {
    login = await fetch(`${UPSTREAM}/api/auth/player_id_login`, {
      method: "POST",
      headers: { ...base, "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, login_id: playerId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("game-id: login request failed", String(e));
    return { ok: false, reason: "unavailable" };
  }
  if (!login.ok) {
    console.error("game-id: login status", login.status, login.headers.get("x-datadome") ? "(datadome)" : "");
    await login.body?.cancel();
    const notFound = login.status === 400 || login.status === 404 || login.status === 422;
    return { ok: false, reason: notFound ? "not_found" : "unavailable" };
  }
  // deno-lint-ignore no-explicit-any
  let loginData: any;
  try {
    loginData = await login.json();
  } catch {
    console.error("game-id: login response is not JSON");
    return { ok: false, reason: "unavailable" };
  }
  const openId = typeof loginData?.open_id === "string" ? loginData.open_id : null;
  if (!openId) return { ok: false, reason: "not_found" };

  // 2) characters on that account. The upstream site ties this call to the login above via its session cookie,
  //    so forward the cookies it set (this is just normal HTTP client behaviour).
  const setCookies = typeof login.headers.getSetCookie === "function" ? login.headers.getSetCookie() : [];
  const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const qs = new URLSearchParams({ app_id: String(APP_ID), region: "IN.TH", language: "th", source: "mb" });
  let rolesRes: Response;
  try {
    rolesRes = await fetch(`${UPSTREAM}/api/shop/apps/roles?${qs}`, {
      headers: { ...base, ...(cookie ? { Cookie: cookie } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("game-id: roles request failed", String(e));
    return { ok: false, reason: "unavailable" };
  }
  if (!rolesRes.ok) {
    console.error("game-id: roles status", rolesRes.status, rolesRes.headers.get("x-datadome") ? "(datadome)" : "");
    await rolesRes.body?.cancel();
    return { ok: false, reason: "unavailable" };
  }
  // deno-lint-ignore no-explicit-any
  let rolesData: any;
  try {
    rolesData = await rolesRes.json();
  } catch {
    console.error("game-id: roles response is not JSON");
    return { ok: false, reason: "unavailable" };
  }
  const list = rolesData?.[String(APP_ID)];
  const roles: Array<Record<string, unknown>> = Array.isArray(list) ? list : [];
  // Only trust a character that belongs to the account we just looked up.
  const mine = roles.find((r) => r?.open_id === openId);
  if (!mine) {
    console.error("game-id: no matching role", { cookie: cookie ? "sent" : "none", roles: roles.length });
    return { ok: false, reason: "not_found" };
  }
  const ign = clean(mine.role, 40);
  if (!ign) return { ok: false, reason: "not_found" };
  return { ok: true, ign, server: clean(mine.server, 40) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "bad request" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!user.email_confirmed_at) {
    return json({ error: "กรุณายืนยันอีเมลก่อนผูกไอดีเกม", code: "email_unverified" }, 403);
  }

  let body: { action?: string; player_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (body.action !== "link" && body.action !== "refresh" && body.action !== "unlink") {
    return json({ error: "bad request" }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  if (body.action === "unlink") {
    const { error } = await admin.from("game_identities").delete().eq("user_id", user.id);
    if (error) {
      console.error("game-id: unlink failed", error.message);
      return json({ error: "ยกเลิกการผูกไม่สำเร็จ" }, 500);
    }
    return json({ ok: true });
  }

  const { data: existing } = await admin
    .from("game_identities")
    .select("player_id, refreshed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let playerId: string;
  let kind: "link" | "refresh";
  if (body.action === "refresh") {
    if (!existing) return json({ error: "ยังไม่ได้ผูกไอดีเกม", code: "not_linked" }, 400);
    playerId = existing.player_id as string;
    kind = "refresh";
  } else {
    const raw = typeof body.player_id === "string" ? body.player_id.replace(/[\s-]/g, "") : "";
    if (!/^[0-9]{8,20}$/.test(raw)) return json({ error: "OpenID ต้องเป็นตัวเลข 8–20 หลัก", code: "bad_id" }, 400);
    playerId = raw;
    kind = existing && existing.player_id === raw ? "refresh" : "link";
  }

  const now = Date.now();
  if (kind === "refresh" && existing) {
    const left = REFRESH_COOLDOWN_MS - (now - new Date(existing.refreshed_at as string).getTime());
    if (left > 0) {
      const hours = Math.ceil(left / HOUR_MS);
      return json({ error: `รีเฟรชชื่อได้วันละ 1 ครั้ง ลองใหม่ในอีกประมาณ ${hours} ชั่วโมง`, code: "cooldown" }, 429);
    }
  }

  const { count: recent } = await admin
    .from("game_lookups")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("kind", ["link", "refresh"])
    .gte("created_at", new Date(now - HOUR_MS).toISOString());
  if ((recent ?? 0) >= MAX_LOOKUPS_PER_HOUR) {
    return json({ error: "ค้นหาถี่เกินไป ลองใหม่อีกครั้งภายใน 1 ชั่วโมง", code: "rate_limited" }, 429);
  }
  if (kind === "link") {
    const { count: links } = await admin
      .from("game_lookups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "link")
      .eq("ok", true)
      .gte("created_at", new Date(now - 30 * DAY_MS).toISOString());
    if ((links ?? 0) >= MAX_LINKS_PER_30D) {
      return json({ error: `เปลี่ยนไอดีเกมได้ไม่เกิน ${MAX_LINKS_PER_30D} ครั้งต่อ 30 วัน`, code: "link_limit" }, 429);
    }
  }

  // Count the attempt before calling out, so failures and crashes also use up the quota.
  const { data: logRow } = await admin.from("game_lookups").insert({ user_id: user.id, kind, ok: false }).select("id").single();

  const res = await lookupPlayer(playerId);
  if (!res.ok) {
    return res.reason === "not_found"
      ? json({ error: "ไม่พบ OpenID นี้ในเกม RoV ตรวจสอบว่าคัดลอกจากในเกมถูกต้อง", code: "not_found" }, 404)
      : json({ error: "ตรวจสอบกับเซิร์ฟเวอร์เกมไม่สำเร็จในตอนนี้ ลองใหม่อีกครั้งภายหลัง", code: "unavailable" }, 503);
  }

  const nowIso = new Date(now).toISOString();
  if (kind === "refresh") {
    const { error } = await admin
      .from("game_identities")
      .update({ ign: res.ign, server: res.server, refreshed_at: nowIso })
      .eq("user_id", user.id);
    if (error) {
      console.error("game-id: refresh save failed", error.message);
      return json({ error: "บันทึกชื่อไม่สำเร็จ" }, 500);
    }
  } else {
    const { error } = await admin.from("game_identities").upsert(
      { user_id: user.id, player_id: playerId, ign: res.ign, server: res.server, verified_at: nowIso, refreshed_at: nowIso },
      { onConflict: "user_id" },
    );
    if (error?.code === "23505") {
      return json({ error: "OpenID นี้ถูกผูกกับบัญชีอื่นแล้ว ถ้าเป็นไอดีของคุณ กรุณาแจ้งแอดมิน", code: "taken" }, 409);
    }
    if (error) {
      console.error("game-id: link save failed", error.message);
      return json({ error: "บันทึกชื่อไม่สำเร็จ" }, 500);
    }
  }
  if (logRow) await admin.from("game_lookups").update({ ok: true }).eq("id", logRow.id);

  return json({ ok: true, ign: res.ign, server: res.server, refreshedAt: nowIso, kind });
});
