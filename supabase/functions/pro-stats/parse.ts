// ตาราง "Hero Statistics" ของ Liquipedia (RoV Pro League) → แถวสำหรับ RPC admin_import_pro_stats
// shortcut: อ่านด้วย regex ตามตำแหน่งคอลัมน์ (รวมคอลัมน์ลำดับ):
//   0 rank · 1 hero · 2-6 Picks ∑ W L WR %T · 7-10 Blue · 11-14 Red · 15-16 Bans ∑ %T · 17-18 Picks&Bans ∑ %T
//   ตรวจทุกแถวว่า W+L = Picks และ P&B = Picks + Bans ถ้าเพี้ยน = Liquipedia เปลี่ยนคอลัมน์ → throw ไม่เดา

export type Tier = "S+" | "S" | "A" | "B" | "C";

export type ProRow = {
  name: string;
  picks: number;
  win_rate: number; // %
  pick_rate: number; // % ของเกมทั้งหมด (Picks %T)
  ban_rate: number; // % ของเกมทั้งหมด (Bans %T)
  sigma: number; // Picks & Bans ∑ — ใช้ตัด Tier
  tier: Tier;
};

// ∑ เทียบค่าสูงสุดของทัวร์นาเมนต์: ≥80% = S+ · ≥60% = S · ≥40% = A · ≥20% = B · ต่ำกว่า = C
// (คูณจำนวนเต็มแทนหาร เพื่อไม่ให้ทศนิยมคลาดตรงขอบ)
export function cutTier(sigma: number, max: number): Tier {
  if (sigma * 5 >= max * 4 && max > 0) return "S+";
  if (sigma * 5 >= max * 3 && max > 0) return "S";
  if (sigma * 5 >= max * 2 && max > 0) return "A";
  if (sigma * 5 >= max && max > 0) return "B";
  return "C";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : 0); // "-" / "" = 0
const pct = (s: string) => {
  const n = parseFloat(s.replace(/[%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function parseProTable(html: string): ProRow[] {
  const found: Omit<ProRow, "tier">[] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const c = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1]));
    // แถวฮีโร่ = มีชื่อ + ช่อง P&B ∑ เป็นตัวเลข (แถวหัวตาราง/ตารางย่อยใน Details ไม่ผ่าน)
    if (c.length < 19 || !c[1] || !/^\d+$/.test(c[17])) continue;
    const [picks, wins, losses, bans, sigma] = [int(c[2]), int(c[3]), int(c[4]), int(c[15]), int(c[17])];
    if (wins + losses !== picks || picks + bans !== sigma) {
      throw new Error(`โครงสร้างตารางไม่ตรงที่คาดไว้ (ฮีโร่ ${c[1]}: W+L ต้องเท่ากับ Picks และ P&B ต้องเท่ากับ Picks+Bans) — Liquipedia อาจเปลี่ยนคอลัมน์`);
    }
    found.push({
      name: c[1],
      picks,
      win_rate: picks > 0 ? Math.round((wins / picks) * 10000) / 100 : 0,
      pick_rate: pct(c[6]),
      ban_rate: pct(c[16]),
      sigma,
    });
  }
  if (found.length === 0) throw new Error("ไม่พบตารางสถิติฮีโร่ในหน้านี้");
  if (new Set(found.map((r) => r.name.toLowerCase())).size !== found.length) {
    throw new Error("พบชื่อฮีโร่ซ้ำในหน้านี้ (อาจมีหลายตารางต่อหน้า) — ไม่รวมให้เอง");
  }
  const max = Math.max(...found.map((r) => r.sigma));
  return found.map((r) => ({ ...r, tier: cutTier(r.sigma, max) })).sort((a, b) => b.sigma - a.sigma);
}
