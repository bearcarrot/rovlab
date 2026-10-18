// อ่านรายการ Encodeparam (ep.json) — รองรับ 3 รูปแบบเดียวกับ index.php เดิม:
//   ["ค่า1","ค่า2"] | [{"label":"A","value":"...","at":1760000000000}] | {"A":"...","B":"..."}
// "at" (ms ตั้งแต่ epoch, ไม่บังคับ) = เวลาที่สร้าง EP ใช้คำนวณอายุ
// ไฟล์นี้ไม่ใช้ API ของ Deno เพื่อให้เทสต์ด้วย node ได้ (สำเนาฝั่งเว็บอยู่ที่ src/lib/epList.ts — แก้สองที่ให้ตรงกัน)

export type EpItem = { label: string; value: string; at: number | null };

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

// คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้ — กันค่าว่าง/ยาวเกิน/มีตัวควบคุม (ใช้ใส่ header)
export function epError(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return "ไม่มี Encodeparam";
  if (v.length > 4096) return "Encodeparam ยาวเกินไป";
  if (/[\u0000-\u001f\u007f]/.test(v)) return "Encodeparam มีอักขระควบคุม";
  return null;
}
