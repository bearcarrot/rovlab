// รายการ Encodeparam ฝั่งหน้า admin — สำเนาของ supabase/functions/game-fetch/eplist.ts (แก้สองที่ให้ตรงกัน)
// รองรับ ["ค่า1","ค่า2"] | [{"label","value","at"?}] | {"A":"...","B":"..."} เหมือน index.php เดิม

export type EpItem = { label: string; value: string; at: number | null };
// ค่าที่เก็บในเบราว์เซอร์: at เสมอมีค่า (ถ้าไฟล์ไม่มี at จะใช้เวลานำเข้า และ est = true)
export type StoredEp = { label: string; value: string; at: number; est?: true };

export const EP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function parseEpList(input: unknown): EpItem[] {
  const entries: [string | number, unknown][] = Array.isArray(input)
    ? input.map((v, i): [number, unknown] => [i, v])
    : input && typeof input === "object"
      ? Object.entries(input as Record<string, unknown>)
      : [];
  const out: EpItem[] = [];
  for (const [k, v] of entries) {
    const n = out.length + 1;
    if (typeof v === "string" && v.trim() !== "") {
      out.push({ label: typeof k === "string" ? k : `EP ${n}`, value: v.trim(), at: null });
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.value === "string" && o.value.trim() !== "") {
        const at = typeof o.at === "number" && Number.isFinite(o.at) && o.at > 0 ? o.at : null;
        out.push({ label: typeof o.label === "string" && o.label !== "" ? o.label : `EP ${n}`, value: o.value.trim(), at });
      }
    }
  }
  return out;
}

// อ่านข้อความไฟล์ ep.json → รายการที่เก็บได้ (โยน Error ภาษาไทยถ้าอ่านไม่ได้)
export function parseEpText(text: string, now: number = Date.now()): StoredEp[] {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("อ่านไฟล์ไม่ได้ ต้องเป็น JSON");
  }
  const items = parseEpList(json);
  if (items.length === 0) throw new Error("ไม่พบ Encodeparam ในไฟล์");
  return items.map((it) => (it.at != null ? { label: it.label, value: it.value, at: it.at } : { label: it.label, value: it.value, at: now, est: true }));
}

// ท้ายค่า EP ไว้ระบุตัว (ไม่โชว์ค่าเต็ม)
export const epTail = (value: string): string => value.trim().slice(-6);

// "x นาที" / "x.y ชม." (เหมือนตัวสลับใน index.php)
export function epAge(at: number, now: number = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60000));
  return m < 60 ? `${m} นาที` : `${Math.round(m / 6) / 10} ชม.`;
}

export const epExpired = (at: number, now: number = Date.now()): boolean => now - at > EP_MAX_AGE_MS;
