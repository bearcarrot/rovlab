import { drawBackground, drawEmptySlot, drawHeroIcon, drawStars, fillRound, font, text, wrapLines } from "../draw";
import { drawLogo } from "../logo";
import { COLORS, CREDIT_TH, DISCLAIMER_TH, SITE_LABEL, SITE_URL } from "../theme";
import type { ImageTemplate, ShareHero } from "../types";

export interface DraftImageData {
  mine: (ShareHero | null)[];
  enemy: (ShareHero | null)[];
  recs: { hero: ShareHero; stars: number; tags: string[] }[];
  /** ค่า 0..1 ต่อแถว (ความยาวแถบ) */
  meters: { label: string; value: number }[];
  damage: { physical: number; magic: number };
  /** ข้อความโหมดการแนะนำ เช่น "โหมด First Pick" */
  modeLabel: string;
  /** ข้อความ Coach Ai — ใส่เมื่อผู้ใช้เปิดตัวเลือกเท่านั้น (ค่าเริ่มต้นปิด) */
  aiCoach?: string | null;
  generatedDate: string;
}

const W = 1080;
const H = 1350;
const PAD = 40;
const COL_GAP = 32;
const COL_W = (W - PAD * 2 - COL_GAP) / 2;
const LOGO_SIZE = 58;
const BRAND_X = PAD + LOGO_SIZE + 16;

// HEURISTIC ต้องอยู่บนรูปเสมอ (ไม่ขึ้นกับ Coach Ai)
const HEURISTIC_NOTE = "คำแนะนำเบื้องต้นจากข้อมูล Role, Team Composition และข้อมูลในระบบ — ไม่ใช่การวิเคราะห์ข้อมูลการแข่งขันหรือระดับสกิลแบบเรียลไทม์";

const TAG_TH: Record<string, string> = { firstPick: "First Pick", counter: "ชนะทางศัตรู", synergy: "คอมโบ" };

function cleanMarkdown(s: string) {
  return s.replace(/[*#`>_]/g, "").replace(/^\s*[-•]\s*/gm, "• ").trim();
}

export const draftAssistantTemplate: ImageTemplate<DraftImageData> = {
  id: "draft-assistant",
  width: W,
  height: H,
  collectImageUrls: (d) => [...d.mine, ...d.enemy].filter((h): h is ShareHero => !!h).map((h) => h.icon).concat(d.recs.map((r) => r.hero.icon)),
  draw({ ctx, images }, d) {
    drawBackground(ctx, W, H);
    const ai = d.aiCoach ? cleanMarkdown(d.aiCoach) : "";
    const rowH = ai ? 70 : 82;
    const icon = rowH - 10;

    // Header: โลโก้ + ชื่อแบรนด์
    drawLogo(ctx, images, PAD, 34, LOGO_SIZE);
    text(ctx, SITE_LABEL, BRAND_X, 62, { font: font(700, 30, "display"), color: COLORS.accent });
    text(ctx, "DRAFT ASSISTANT", BRAND_X, 90, { font: font(500, 20, "display"), color: COLORS.muted });
    text(ctx, d.modeLabel, W - PAD, 90, { font: font(500, 22), color: COLORS.muted, align: "right" });

    // Teams
    const teamsY = 128;
    const drawTeam = (label: string, color: string, team: (ShareHero | null)[], x: number) => {
      fillRound(ctx, x, teamsY, COL_W, 38 + rowH * 5 + 14, 16, COLORS.surface, COLORS.border);
      text(ctx, label, x + 20, teamsY + 30, { font: font(700, 24, "display"), color });
      team.slice(0, 5).forEach((hero, i) => {
        const y = teamsY + 44 + i * rowH;
        if (hero) {
          drawHeroIcon(ctx, images, hero, x + 20, y, icon);
          text(ctx, hero.name, x + 20 + icon + 16, y + icon / 2, { font: font(600, 26), color: COLORS.text, baseline: "middle", maxWidth: COL_W - icon - 56 });
        } else {
          drawEmptySlot(ctx, x + 20, y, icon);
          text(ctx, "Empty Slot", x + 20 + icon + 16, y + icon / 2, { font: font(400, 22), color: COLORS.faint, baseline: "middle" });
        }
      });
    };
    drawTeam("ทีมเรา", COLORS.win, d.mine, PAD);
    drawTeam("ทีมศัตรู", COLORS.loss, d.enemy, PAD + COL_W + COL_GAP);

    // Team Overview + Recommended
    const colY = teamsY + 38 + rowH * 5 + 14 + 22;
    const colH = ai ? 372 : 420;
    fillRound(ctx, PAD, colY, COL_W, colH, 16, COLORS.surface, COLORS.border);
    fillRound(ctx, PAD + COL_W + COL_GAP, colY, COL_W, colH, 16, COLORS.surface, COLORS.border);

    // Overview
    text(ctx, "TEAM OVERVIEW", PAD + 20, colY + 34, { font: font(700, 22, "display"), color: COLORS.accent });
    const total = d.damage.physical + d.damage.magic;
    const barW = COL_W - 40;
    const dy = colY + 54;
    text(ctx, "ดาเมจกายภาพ", PAD + 20, dy + 14, { font: font(400, 18), color: COLORS.muted });
    text(ctx, "ดาเมจเวท", PAD + 20 + barW, dy + 14, { font: font(400, 18), color: COLORS.muted, align: "right" });
    fillRound(ctx, PAD + 20, dy + 24, barW, 14, 7, COLORS.raised);
    const pw = total ? (d.damage.physical / total) * barW : barW / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD + 20, dy + 24, barW, 14, 7);
    ctx.clip();
    ctx.fillStyle = COLORS.rift;
    ctx.fillRect(PAD + 20, dy + 24, pw, 14);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(PAD + 20 + pw, dy + 24, barW - pw, 14);
    ctx.restore();
    const my0 = dy + 64;
    const step = (colH - (my0 - colY) - 18) / Math.max(1, d.meters.length);
    d.meters.forEach((m, i) => {
      const y = my0 + i * step;
      text(ctx, m.label, PAD + 20, y + 12, { font: font(400, 18), color: COLORS.muted, maxWidth: barW });
      fillRound(ctx, PAD + 20, y + 20, barW, 10, 5, COLORS.raised);
      const v = Math.max(0, Math.min(1, m.value));
      if (v > 0) fillRound(ctx, PAD + 20, y + 20, Math.max(10, barW * v), 10, 5, COLORS.accent);
    });

    // Recommended
    const rx = PAD + COL_W + COL_GAP;
    text(ctx, "RECOMMENDED PICKS", rx + 20, colY + 34, { font: font(700, 22, "display"), color: COLORS.accent });
    const rStep = (colH - 54 - 12) / 5;
    if (d.recs.length === 0) {
      text(ctx, "ยังไม่มีฮีโร่ให้แนะนำ", rx + 20, colY + 90, { font: font(400, 20), color: COLORS.faint });
    }
    d.recs.slice(0, 5).forEach((r, i) => {
      const y = colY + 54 + i * rStep;
      const s = Math.min(rStep - 8, 56);
      drawHeroIcon(ctx, images, r.hero, rx + 20, y, s);
      text(ctx, r.hero.name, rx + 20 + s + 14, y + s * 0.4, { font: font(600, 22), color: COLORS.text, baseline: "middle", maxWidth: COL_W - s - 54 });
      drawStars(ctx, rx + 20 + s + 14, y + s * 0.78, r.stars, 5, 8);
      const tag = r.tags.map((t) => TAG_TH[t] ?? t)[0];
      if (tag) text(ctx, tag, rx + COL_W - 20, y + s * 0.78, { font: font(500, 16), color: COLORS.muted, align: "right", baseline: "middle" });
    });

    // Coach Ai (เฉพาะเมื่อผู้ใช้เลือกใส่)
    let y = colY + colH + 20;
    if (ai) {
      const boxH = 150;
      fillRound(ctx, PAD, y, W - PAD * 2, boxH, 16, "rgba(232,163,61,0.06)", "rgba(232,163,61,0.35)");
      text(ctx, "Coach Ai", PAD + 20, y + 32, { font: font(700, 20, "display"), color: COLORS.accent });
      ctx.font = font(400, 20);
      const lines = wrapLines(ctx, ai, W - PAD * 2 - 40, 4);
      lines.forEach((l, i) => text(ctx, l, PAD + 20, y + 62 + i * 26, { font: font(400, 20), color: COLORS.text }));
      y += boxH + 14;
    }

    // HEURISTIC (แสดงเสมอ)
    const hy = Math.max(y, ai ? y : H - 250);
    fillRound(ctx, PAD, hy, W - PAD * 2, 112, 16, "rgba(76,141,255,0.08)", "rgba(76,141,255,0.4)");
    fillRound(ctx, PAD + 20, hy + 18, 128, 32, 8, COLORS.rift);
    text(ctx, "HEURISTIC", PAD + 20 + 64, hy + 34, { font: font(700, 18, "display"), color: "#FFFFFF", align: "center", baseline: "middle" });
    ctx.font = font(400, 19);
    wrapLines(ctx, HEURISTIC_NOTE, W - PAD * 2 - 40, 2).forEach((l, i) =>
      text(ctx, l, PAD + 20, hy + 74 + i * 24, { font: font(400, 19), color: COLORS.muted })
    );

    // Footer
    const fy = H - 76;
    text(ctx, `${SITE_LABEL}  ·  ${SITE_URL}`, PAD, fy + 4, { font: font(600, 22, "display"), color: COLORS.text });
    text(ctx, `Generated: ${d.generatedDate}`, W - PAD, fy + 4, { font: font(500, 20), color: COLORS.muted, align: "right" });
    text(ctx, `${DISCLAIMER_TH} · ${CREDIT_TH}`, PAD, fy + 34, { font: font(400, 16), color: COLORS.faint, maxWidth: W - PAD * 2 });
  },
};
