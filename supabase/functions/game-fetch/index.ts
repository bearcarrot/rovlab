import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { epError, itopError, parseEpList, type EpItem } from "./eplist.ts";

// ดึงสถิติแรงก์ (getranklist) / ประวัติปรับบาลานซ์ (getlatestadjustlist) / สกิลของฮีโร่ (skills) จากเซิร์ฟเวอร์เกมแทนหน้า index.php เดิม
// ไม่เขียน DB เอง — หน้า Admin นำผลไป parse/พรีวิว แล้วเรียก RPC admin_import_* ที่มีอยู่ (เหมือน pro-stats)
// เฉพาะ Super Admin (is_super_admin ด้วย JWT ผู้เรียก — แอดมินธรรมดาใช้ไม่ได้) · client ส่งได้แค่ kind/rank_key/EP(+itop)/hero_id — URL และ body ประกอบฝั่งนี้เอง (กัน SSRF)
// Encodeparam และ Msdk-Itopencodeparam คือ credential ของเซสชัน: ไม่ log ไม่เก็บ ไม่ใส่ query string และส่งเป็น header เท่านั้น
// Msdk-Itopencodeparam ผูกเป็นคู่กับ EP แต่ละค่า (คนละเซสชันใช้ปนกันไม่ได้ เกมตอบ -5001) จึงส่งมาพร้อม EP (itop)
//   ถ้าไม่มี itop ส่งมา จะใช้ค่าที่อยู่ใน GAME_API_HEADERS แทน (พฤติกรรมเดิม)
//
// Supabase secrets (ตั้งด้วย `supabase secrets set`):
//   GAME_API_HEADERS  (ไม่บังคับ) JSON ของ header คงที่เพิ่มเติม เช่น {"User-Agent":"..."} เท่ากับ api_headers ใน config.php เดิม
//                     ไม่ควรใส่ Msdk-Itopencodeparam ที่นี่ ถ้าหมุน EP หลายค่า (ให้ไปกับ EP ใน ep.json แทน)
//   GAME_SKILLS_URL  (ไม่บังคับ) URL https ของ API สกิล ค่าเริ่มต้น https://kgth-api.mobagarena.com/api/hero/getskilllist โฮสต์ต้องลงท้าย .mobagarena.com
//   GAME_EP_HEADER    (ไม่บังคับ) ชื่อ header ของ Encodeparam, ค่าเริ่มต้น "Encodeparam"
//   GAME_ITOP_HEADER  (ไม่บังคับ) ชื่อ header ของ itop, ค่าเริ่มต้น "Msdk-Itopencodeparam"
//   GAME_HERO_HEADER  (ไม่บังคับ) ชื่อ header ที่ใช้ส่ง hero_id ให้ API สกิล, ค่าเริ่มต้น "hero_id"
//   EP_LIST_URL       (ไม่บังคับ) URL https ของ ep.json บนโฮสต์ของเรา ใช้กับโหมด "URL"
//   EP_LIST_KEY       (ไม่บังคับ) ส่งเป็น Authorization: Bearer ไปกับ EP_LIST_URL

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const API_BASE = "https://kgth-api.mobagarena.com/api/hero/";
const GAME_TYPES = { all: 1, high: 3 } as const; // rank_tier ใน DB => gameType (ค่าเริ่มต้นเดียวกับ index.php)
const REVIEW_SCENE = 513;
const TIMEOUT_MS = 20_000;
const MAX_BODY_CHARS = 5_000_000;
const DROP_HEADERS = ["host", "content-length", "connection", "transfer-encoding"];
const GAME_HOST_SUFFIX = ".mobagarena.com";

type Meta = { via: "direct"; status: number; ms: number };

function extraHeaders(): Headers {
  const h = new Headers();
  try {
    const raw = Deno.env.get("GAME_API_HEADERS");
    const obj = raw ? JSON.parse(raw) : {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string" && !DROP_HEADERS.includes(k.toLowerCase())) h.set(k, v);
    }
  } catch {
    // GAME_API_HEADERS ไม่ใช่ JSON — ข้าม (ใช้ header พื้นฐานแทน)
  }
  return h;
}

// URL ของ API สกิล: ค่าเริ่มต้นอยู่ในโค้ด (host เดียวกับ rank/adjust) override ได้ด้วย secret (ไม่ให้ client ส่งมาเอง)
// ต้องเป็น https ในโดเมน mobagarena.com เท่านั้น
function skillsUrl(): { url: string } | { error: string } {
  const raw = Deno.env.get("GAME_SKILLS_URL") || API_BASE + "getskilllist";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !u.hostname.endsWith(GAME_HOST_SUFFIX)) throw new Error("bad host");
    return { url: u.toString() };
  } catch {
    return { error: `GAME_SKILLS_URL ต้องเป็น https ในโดเมน *${GAME_HOST_SUFFIX}` };
  }
}

async function loadEpList(): Promise<{ items: EpItem[] } | { error: string; status: number }> {
  const raw = Deno.env.get("EP_LIST_URL");
  if (!raw) return { error: "ยังไม่ได้ตั้ง EP_LIST_URL ใน Supabase secrets", status: 400 };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "EP_LIST_URL ไม่ใช่ URL ที่ถูกต้อง", status: 500 };
  }
  if (url.protocol !== "https:") return { error: "EP_LIST_URL ต้องเป็น https", status: 500 };
  const key = Deno.env.get("EP_LIST_KEY");
  try {
    // redirect: "error" — ไม่ตามไปโดเมนอื่นพร้อม Bearer key
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!res.ok) return { error: `เซิร์ฟเวอร์ ep.json ตอบ HTTP ${res.status}`, status: 502 };
    const items = parseEpList(await res.json());
    if (items.length === 0) return { error: "ไม่พบ Encodeparam ใน ep.json ที่ URL", status: 422 };
    return { items };
  } catch {
    return { error: "โหลด ep.json จาก URL ไม่สำเร็จ", status: 502 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "ใช้ POST เท่านั้น" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  // ต้องเป็น Super Admin เท่านั้น (แอดมินธรรมดาไม่ผ่าน) — ฝั่งหน้าซ่อนแท็บให้ด้วย แต่นี่คือด่านจริง เพราะ function นี้ถือ credential ของเกม
  const { data: isSuper } = await sb.rpc("is_super_admin");
  if (isSuper !== true) return json({ error: "ต้องเป็น Super Admin เท่านั้น" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "คำขอไม่ใช่ JSON" }, 400);
  }

  // รายการ EP จาก URL — คืนเฉพาะ label/อายุ/ท้ายค่า/มี itop ไหม ไม่ส่งค่า EP หรือ itop กลับไปที่เบราว์เซอร์
  if (body.action === "list_eps") {
    const r = await loadEpList();
    if ("error" in r) return json({ error: r.error }, r.status);
    return json({
      items: r.items.map((it, index) => ({ index, label: it.label, at: it.at, tail: it.value.slice(-6), has_itop: Boolean(it.itop) })),
    });
  }

  const kind = body.kind;
  if (kind !== "rank" && kind !== "adjust" && kind !== "skills") return json({ error: "kind ต้องเป็น rank, adjust หรือ skills" }, 400);

  // เลือก EP (+ itop คู่กัน): ที่ส่งมาตรง ๆ (วางเอง/ไฟล์) หรือลำดับในรายการจาก URL
  let ep = "";
  let itop = "";
  if (typeof body.ep === "string" && body.ep.trim() !== "") {
    ep = body.ep.trim();
    if (typeof body.itop === "string") itop = body.itop.trim();
  } else if (Number.isInteger(body.ep_index)) {
    const r = await loadEpList();
    if ("error" in r) return json({ error: r.error }, r.status);
    const it = r.items[body.ep_index as number];
    if (!it) return json({ error: "ไม่มี EP ลำดับนี้ในรายการ" }, 400);
    ep = it.value;
    itop = it.itop ?? "";
  }
  const bad = epError(ep);
  if (bad) return json({ error: bad }, 400);
  const badItop = itopError(itop);
  if (badItop) return json({ error: badItop }, 400);

  // ตัดค่า EP/itop ออกจากข้อความที่จะส่งกลับ เผื่อเซิร์ฟเวอร์เกม echo header
  const scrub = (s: string) => [ep, itop].filter(Boolean).reduce((acc, v) => acc.split(v).join("***"), s);

  let url: string;
  let payload: Record<string, unknown>;
  let listKey: "heroList" | "heroAdjustList" | "skillList";
  let heroId: number | null = null;
  if (kind === "rank") {
    const rk = body.rank_key;
    if (rk !== "all" && rk !== "high") return json({ error: "rank_key ต้องเป็น all หรือ high" }, 400);
    url = API_BASE + "getranklist";
    payload = { gameType: GAME_TYPES[rk], reviewScene: REVIEW_SCENE };
    listKey = "heroList";
  } else if (kind === "adjust") {
    url = API_BASE + "getlatestadjustlist";
    payload = {};
    listKey = "heroAdjustList";
  } else {
    const hid = body.hero_id;
    if (!Number.isInteger(hid) || (hid as number) <= 0 || (hid as number) > 1_000_000) return json({ error: "hero_id ไม่ถูกต้อง" }, 400);
    const u = skillsUrl();
    if ("error" in u) return json({ error: u.error }, 500);
    url = u.url;
    payload = { hero_id: hid };
    heroId = hid as number;
    listKey = "skillList";
  }

  const headers = extraHeaders();
  headers.set(Deno.env.get("GAME_EP_HEADER") || "Encodeparam", ep);
  // itop ที่คู่กับ EP ทับค่าใน GAME_API_HEADERS ถ้าไม่มี คงค่าใน secret ไว้ (พฤติกรรมเดิม)
  if (itop) headers.set(Deno.env.get("GAME_ITOP_HEADER") || "Msdk-Itopencodeparam", itop);
  // API สกิลต้องการ hero_id ใน header ด้วย (นอกจาก body)
  if (heroId !== null) headers.set(Deno.env.get("GAME_HERO_HEADER") || "hero_id", String(heroId));
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const t0 = Date.now();
  let status: number;
  let text: string;
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(TIMEOUT_MS) });
    status = res.status;
    text = await res.text();
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    return json({ error: timeout ? `เซิร์ฟเวอร์เกมไม่ตอบใน ${TIMEOUT_MS / 1000} วินาที` : "เชื่อมต่อเซิร์ฟเวอร์เกมไม่ได้" }, 502);
  }
  const meta: Meta = { via: "direct", status, ms: Date.now() - t0 };

  const snippet = scrub(text.slice(0, 200));
  if (text.length > MAX_BODY_CHARS) return json({ error: "ผลตอบกลับจากเกมใหญ่ผิดปกติ", meta }, 502);
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // ไม่ใช่ JSON
  }
  if (status !== 200 || parsed === null) {
    return json({ error: `เกมตอบ HTTP ${status}${parsed === null ? " (ไม่ใช่ JSON)" : ""}: ${snippet}`, meta }, 502);
  }
  if (!Array.isArray(parsed?.data?.[listKey]) || parsed.data[listKey].length === 0) {
    const msg = scrub(String(parsed?.msg ?? parsed?.message ?? "").slice(0, 120));
    return json({ error: `ไม่พบ ${listKey} ในผลตอบกลับ (code=${parsed?.code ?? "?"}${msg ? ` ${msg}` : ""}) ลองตรวจ Encodeparam`, meta }, 422);
  }
  return json({ data: parsed, meta });
});
