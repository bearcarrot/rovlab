import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseProTable } from "./parse.ts";

// ดึงสถิติฮีโร่ของ RoV Pro League จาก Liquipedia (ผ่าน MediaWiki API) แล้วคืนแถวพร้อม Tier ให้หน้า Admin แสดงก่อนบันทึก
// ไม่เขียน DB เอง — หน้า Admin เรียก RPC admin_import_pro_stats ต่อ (migration 20261015)
// เฉพาะแอดมิน · รับเฉพาะ URL หน้า .../honorofkings/RoV_Pro_League/<ปี>/<ฤดู>/Statistics (กัน SSRF/ยิงหน้าอื่น)
// Liquipedia กำหนดให้ใส่ User-Agent ที่ระบุตัวตน และ action=parse ยิงได้ไม่เกิน 1 ครั้ง/30 วินาที (กดทีละครั้งจากหน้า Admin)
// ข้อมูลเป็น CC-BY-SA 3.0 ต้องให้เครดิต Liquipedia ในหน้าที่แสดงผล

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PAGE = /^\/honorofkings\/(RoV_Pro_League\/[\w-]+\/[\w-]+\/Statistics)\/?$/;
const UA = "RoVLab/1.0 (https://rovlab.vercel.app; admin stats import)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "ต้องเป็นแอดมินเท่านั้น" }, 403);

  let page: string;
  try {
    const { url } = await req.json();
    const u = new URL(String(url));
    const m = u.hostname === "liquipedia.net" ? PAGE.exec(u.pathname) : null;
    if (!m) throw new Error();
    page = m[1];
  } catch {
    return json({ error: "URL ต้องเป็นหน้า Statistics ของ RoV Pro League บน liquipedia.net/honorofkings" }, 400);
  }

  const api = `https://liquipedia.net/honorofkings/api.php?action=parse&format=json&prop=text&disablelimitreport=1&page=${encodeURIComponent(page)}`;
  let res: Response;
  try {
    res = await fetch(api, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
  } catch {
    return json({ error: "เชื่อมต่อ Liquipedia ไม่ได้" }, 502);
  }
  if (res.status === 429) return json({ error: "Liquipedia จำกัดความถี่ — รอ 30 วินาทีแล้วลองใหม่" }, 429);
  if (!res.ok) return json({ error: `Liquipedia ตอบ ${res.status}` }, 502);

  const html = (await res.json().catch(() => null))?.parse?.text?.["*"];
  if (typeof html !== "string") return json({ error: "Liquipedia ไม่คืนเนื้อหาหน้านี้ (ชื่อหน้าผิดหรือยังไม่มี)" }, 502);

  try {
    return json({ page, rows: parseProTable(html) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "อ่านตารางไม่สำเร็จ" }, 422);
  }
});
