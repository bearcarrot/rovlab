// แปลงผลตอบกลับ API สกิล (data.skillList) → แถว hero_abilities — พอร์ตจาก parse_skills / การ upsert ใน index.php เดิม
// ไม่ผูกกับ DOM/React เพื่อให้เทสต์ด้วย node ได้ (tests/game-fetch/skills.test.ts)

export type SkillTag = { type: number; name: string };
export type Skill = { idx: number; name: string; desc: string; icon: string; tags: SkillTag[] };
export type AbilityRow = {
  game_id: number; // heroes.hero_id (ใช้จับคู่ ไม่ได้ส่งขึ้น DB)
  slot: string;
  name: string;
  description: string;
  sort_order: number;
  icon_url: string | null;
  effect_tags: SkillTag[];
};
export type Existing = { name: string; icon_url: string | null };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

// ล้างแท็กสี (<color=...>) และ \n ตัวอักษรให้เป็นขึ้นบรรทัดจริง
export function cleanText(s: string): string {
  const t = s
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n|\r/g, "\n");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

const ICON_KEYS = ["icon", "iconUrl", "icon_url", "skillIcon", "skillIconUrl", "img", "image", "pic"];

// หา URL ไอคอนจากหลายชื่อฟิลด์ที่เป็นไปได้
export function pickIcon(sk: Obj): string {
  for (const k of ICON_KEYS) {
    const v = sk[k];
    if (typeof v === "string" && v !== "" && v !== "0") {
      const u = v.trim();
      return u.startsWith("//") ? `https:${u}` : u;
    }
  }
  return "";
}

// เก็บแท็กชนิดสกิล (skillEffectType + name) จากทุกระดับใน object ของสกิล — ไม่ผูกกับชื่อฟิลด์แม่
function collectTags(node: unknown, out: Map<number, SkillTag>): void {
  if (!isObj(node)) return;
  if (!Array.isArray(node) && node.skillEffectType != null) {
    const n = Math.trunc(Number(node.skillEffectType));
    const t = Number.isFinite(n) ? n : 0;
    out.set(t, { type: t, name: cleanText(String(node.name ?? "")) });
  }
  for (const v of Object.values(node)) if (isObj(v)) collectTags(v, out);
}

const toInt = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// ผลตอบกลับของฮีโร่หนึ่งตัว → รายการสกิลที่สะอาดแล้ว (ไม่ใช่รูปแบบ skillList → [])
export function parseSkills(res: unknown): Skill[] {
  const groups = isObj(res) && isObj(res.data) ? res.data.skillList : null;
  if (!Array.isArray(groups)) return [];
  const out: Skill[] = [];
  for (const g of groups) {
    const list = isObj(g) ? g.skills : null;
    if (!Array.isArray(list)) continue;
    for (const sk of list) {
      if (!isObj(sk)) continue;
      const tags = new Map<number, SkillTag>();
      collectTags(sk, tags);
      out.push({
        idx: toInt(sk.skillIdx),
        name: cleanText(String(sk.name ?? "")),
        desc: cleanText(String(sk.desc ?? "")),
        icon: pickIcon(sk),
        tags: [...tags.values()],
      });
    }
  }
  return out;
}

// อ่านข้อมูลที่ได้มา 2 รูปแบบ: { "<hero_id>": ผลตอบกลับดิบของเกม } (จากปุ่มดึง) หรือ { "<hero_id>": Skill[] } (skills.json ของ index.php เดิม)
export function parseSkillsMap(text: string): Map<number, Skill[]> {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("อ่านไฟล์ไม่ได้ ต้องเป็น JSON");
  }
  if (!isObj(json) || Array.isArray(json)) throw new Error("รูปแบบไม่ถูกต้อง ต้องเป็น { hero_id: ... }");
  const out = new Map<number, Skill[]>();
  for (const [k, v] of Object.entries(json)) {
    const gid = Number(k);
    if (!Number.isInteger(gid) || gid <= 0) continue;
    let skills: Skill[];
    if (Array.isArray(v)) {
      skills = v.filter(isObj).map((s) => ({
        idx: toInt(s.idx),
        name: cleanText(String(s.name ?? "")),
        desc: cleanText(String(s.desc ?? "")),
        icon: typeof s.icon === "string" ? s.icon.trim() : "",
        tags: (Array.isArray(s.tags) ? s.tags : [])
          .filter(isObj)
          .map((t) => ({ type: toInt(t.type), name: cleanText(String(t.name ?? "")) })),
      }));
    } else {
      skills = parseSkills(v);
    }
    if (skills.length > 0) out.set(gid, skills);
  }
  if (out.size === 0) throw new Error("ไม่พบสกิลในข้อมูล");
  return out;
}

// สกิลของฮีโร่หนึ่งตัว → แถว hero_abilities
//  - เฉพาะช่อง passive (idx 0) และ 1-4
//  - slot ซ้ำ (ร่างที่สอง/สาม) ใช้รูปแบบ -ex: 1, 1-ex, 1-ex2 ...
//  - sort_order: ร่างปกติก่อน (passive,1,2,3,4) แล้วตามด้วยร่าง ex
//  - ชื่อ: คงชื่อเดิมใน DB ไว้ (ถ้ามี) เว้นแต่ overwriteName · ไอคอน: ถ้า API ไม่มีไอคอนจะคงไอคอนเดิม ไม่ทับเป็นว่าง
export function buildAbilityRows(
  gameId: number,
  skills: Skill[],
  existing: Map<string, Existing>,
  overwriteName: boolean
): { rows: AbilityRow[]; skipped: number; ex: number } {
  const seen = new Map<string, number>();
  const items: { idx: number; n: number; row: AbilityRow }[] = [];
  let skipped = 0;
  let ex = 0;
  for (const s of skills) {
    if (s.idx < 0 || s.idx > 4) {
      skipped++;
      continue;
    }
    const baseSlot = s.idx === 0 ? "passive" : String(s.idx);
    const n = (seen.get(baseSlot) ?? -1) + 1;
    seen.set(baseSlot, n);
    const slot = n === 0 ? baseSlot : `${baseSlot}-ex${n > 1 ? n : ""}`;
    if (n > 0) ex++;
    const old = existing.get(slot);
    items.push({
      idx: s.idx,
      n,
      row: {
        game_id: gameId,
        slot,
        name: overwriteName ? s.name : (old?.name ?? s.name),
        description: s.desc,
        sort_order: 0,
        icon_url: s.icon !== "" ? s.icon : (old?.icon_url ?? null),
        effect_tags: s.tags,
      },
    });
  }
  items.sort((a, b) => a.n - b.n || a.idx - b.idx);
  items.forEach((it, i) => {
    it.row.sort_order = i;
  });
  return { rows: items.map((it) => it.row), skipped, ex };
}
