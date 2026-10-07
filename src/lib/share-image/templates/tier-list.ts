import { drawBackground, drawHeroIcon, fillRound, fitFontSize, font, text } from "../draw";
import { drawLogo } from "../logo";
import { COLORS, CREDIT_TH, DISCLAIMER_TH, SITE_LABEL, SITE_URL, TIER_COLORS } from "../theme";
import type { ImageTemplate, ShareHero } from "../types";

export interface TierListImageData {
  /** ชื่อรายการ เช่น "Tier List ของฉัน" */
  title: string;
  patch: string;
  /** เช่น "All Roles" / "Jungle" */
  filterLabel: string;
  /** ข้อความเสริมท้ายบรรทัดเมตา เช่น ชื่อแรงก์ (ไม่ใส่ก็ได้) */
  extraLabel?: string;
  tiers: { tier: string; heroes: ShareHero[] }[];
  generatedDate: string;
}

const W = 1080;
const H = 1350;
const PAD = 40;
const HEADER_H = 218;
const FOOTER_H = 132;
const LABEL_W = 124;
const GAP = 6;
const ROW_GAP = 12;
const ROW_PAD = 12;
const MIN_ROW_H = 72;
const LOGO_SIZE = 58;
const BRAND_X = PAD + LOGO_SIZE + 16;

function layout(tiers: TierListImageData["tiers"]) {
  const areaW = W - PAD * 2 - LABEL_W - ROW_PAD * 2;
  const availH = H - HEADER_H - FOOTER_H - ROW_GAP * Math.max(0, tiers.length - 1);
  for (let size = 104; size >= 22; size -= 2) {
    const perRow = Math.max(1, Math.floor((areaW + GAP) / (size + GAP)));
    const heights = tiers.map((t) => Math.max(MIN_ROW_H, Math.ceil(t.heroes.length / perRow) * (size + GAP) - GAP + ROW_PAD * 2));
    if (heights.reduce((a, b) => a + b, 0) <= availH || size === 22) return { size, perRow, heights, areaW };
  }
  return { size: 22, perRow: 1, heights: [], areaW };
}

export const tierListTemplate: ImageTemplate<TierListImageData> = {
  id: "tier-list",
  width: W,
  height: H,
  collectImageUrls: (d) => d.tiers.flatMap((t) => t.heroes.map((h) => h.icon)),
  draw({ ctx, images }, d) {
    drawBackground(ctx, W, H);

    // Header: โลโก้ + ชื่อแบรนด์
    drawLogo(ctx, images, PAD, 34, LOGO_SIZE);
    text(ctx, SITE_LABEL, BRAND_X, 62, { font: font(700, 30, "display"), color: COLORS.accent });
    text(ctx, "TIER LIST", BRAND_X, 90, { font: font(500, 20, "display"), color: COLORS.muted });
    const maxTitleW = W - PAD * 2;
    const size = fitFontSize(ctx, d.title, maxTitleW, 700, 64, 30);
    text(ctx, d.title, PAD, 160, { font: font(700, size, "display"), color: COLORS.text, maxWidth: maxTitleW });
    const meta = [`Patch ${d.patch}`, d.filterLabel, d.extraLabel].filter(Boolean).join("  ·  ");
    text(ctx, meta, PAD, 198, { font: font(500, 24), color: COLORS.muted, maxWidth: maxTitleW });

    // Tier rows
    const { size: icon, perRow, heights } = layout(d.tiers);
    let y = HEADER_H;
    d.tiers.forEach((t, i) => {
      const h = heights[i] ?? MIN_ROW_H;
      const c = TIER_COLORS[t.tier] ?? { bg: COLORS.raised, fg: COLORS.text };
      fillRound(ctx, PAD, y, W - PAD * 2, h, 16, COLORS.surface, COLORS.border);
      // ป้าย Tier ซ้าย (สีเดิมของระบบ)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(PAD, y, LABEL_W, h, [16, 0, 0, 16]);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.restore();
      text(ctx, t.tier, PAD + LABEL_W / 2, y + h / 2, {
        font: font(700, t.tier.length > 1 ? 48 : 56, "display"),
        color: c.fg,
        align: "center",
        baseline: "middle",
      });
      const x0 = PAD + LABEL_W + ROW_PAD;
      if (t.heroes.length === 0) {
        text(ctx, "ยังไม่มีฮีโร่", x0, y + h / 2, { font: font(400, 22), color: COLORS.faint, baseline: "middle" });
      }
      t.heroes.forEach((hero, k) => {
        const col = k % perRow;
        const row = Math.floor(k / perRow);
        drawHeroIcon(ctx, images, hero, x0 + col * (icon + GAP), y + ROW_PAD + row * (icon + GAP), icon);
      });
      y += h + ROW_GAP;
    });

    // Footer
    const fy = H - FOOTER_H;
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(PAD, fy + 8, W - PAD * 2, 2);
    text(ctx, `${SITE_LABEL}  ·  ${SITE_URL}`, PAD, fy + 46, { font: font(600, 24, "display"), color: COLORS.text });
    text(ctx, `Generated: ${d.generatedDate}`, W - PAD, fy + 46, { font: font(500, 22), color: COLORS.muted, align: "right" });
    text(ctx, DISCLAIMER_TH, PAD, fy + 80, { font: font(500, 20), color: COLORS.muted, maxWidth: W - PAD * 2 });
    text(ctx, CREDIT_TH, PAD, fy + 108, { font: font(400, 18), color: COLORS.faint, maxWidth: W - PAD * 2 });
  },
};
