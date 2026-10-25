import { readableTextColor } from "../../readableText";
import { drawBackground, drawHeroIcon, fillRound, fitFontSize, font, text } from "../draw";
import { drawLogo } from "../logo";
import { COLORS, CREDIT_TH, DISCLAIMER_TH, SITE_LABEL, SITE_URL, TIER_COLORS } from "../theme";
import type { ImageStore, ImageTemplate, ShareHero } from "../types";
import { FOOTER_H, GAP, H, HEADER_H, LABEL_W, MIN_ROW_H, PAD, W, layout } from "./tierLayout";

export interface TierListImageData {
  /** ชื่อรายการ เช่น "Tier List ของฉัน" */
  title: string;
  patch: string;
  /** เช่น "All Roles" / "Jungle" */
  filterLabel: string;
  /** ข้อความเสริมท้ายบรรทัดเมตา เช่น ชื่อแรงก์ (ไม่ใส่ก็ได้) */
  extraLabel?: string;
  /** color = #RRGGBB ของแถว (Tier List ที่จัดเอง); ไม่ใส่ = ใช้สีมาตรฐานตามชื่อ Tier */
  tiers: { tier: string; color?: string; heroes: ShareHero[] }[];
  generatedDate: string;
}

// ความสูงโลโก้เต็ม (ความกว้างคำนวณจากอัตราส่วนจริง)
const LOGO_H = 64;

/** Header and footer are shared with the lane-grid template (tier-lane-grid.ts). */
export function drawTierHeader(
  ctx: CanvasRenderingContext2D,
  images: ImageStore,
  d: { title: string; patch: string; filterLabel: string; extraLabel?: string }
) {
  // Header: โลโก้เต็ม (มีชื่อแบรนด์อยู่ในโลโก้แล้ว) + ชื่อหน้า
  const logoW = drawLogo(ctx, images, PAD, 28, LOGO_H);
  text(ctx, "TIER LIST", PAD + logoW + 20, 68, { font: font(500, 24, "display"), color: COLORS.muted });
  const maxTitleW = W - PAD * 2;
  const size = fitFontSize(ctx, d.title, maxTitleW, 700, 64, 30);
  text(ctx, d.title, PAD, 160, { font: font(700, size, "display"), color: COLORS.text, maxWidth: maxTitleW });
  const meta = [`Patch ${d.patch}`, d.filterLabel, d.extraLabel].filter(Boolean).join("  ·  ");
  text(ctx, meta, PAD, 198, { font: font(500, 24), color: COLORS.muted, maxWidth: maxTitleW });
}

export function drawTierFooter(ctx: CanvasRenderingContext2D, height: number, generatedDate: string) {
  const fy = height - FOOTER_H;
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(PAD, fy + 8, W - PAD * 2, 2);
  text(ctx, `${SITE_LABEL}  ·  ${SITE_URL}`, PAD, fy + 46, { font: font(600, 24, "display"), color: COLORS.text });
  text(ctx, `Generated: ${generatedDate}`, W - PAD, fy + 46, { font: font(500, 22), color: COLORS.muted, align: "right" });
  text(ctx, DISCLAIMER_TH, PAD, fy + 80, { font: font(500, 20), color: COLORS.muted, maxWidth: W - PAD * 2 });
  text(ctx, CREDIT_TH, PAD, fy + 108, { font: font(400, 18), color: COLORS.faint, maxWidth: W - PAD * 2 });
}

export const tierListTemplate: ImageTemplate<TierListImageData> = {
  id: "tier-list",
  width: W,
  height: H,
  collectImageUrls: (d) => d.tiers.flatMap((t) => t.heroes.map((h) => h.icon)),
  draw({ ctx, images }, d) {
    drawBackground(ctx, W, H);
    drawTierHeader(ctx, images, d);

    // Tier rows
    const { size: icon, perRow, heights, rowGap, pad } = layout(d.tiers);
    let y = HEADER_H;
    d.tiers.forEach((t, i) => {
      const h = heights[i] ?? MIN_ROW_H;
      const c = t.color ? { bg: t.color, fg: readableTextColor(t.color) } : (TIER_COLORS[t.tier] ?? { bg: COLORS.raised, fg: COLORS.text });
      fillRound(ctx, PAD, y, W - PAD * 2, h, 16, COLORS.surface, COLORS.border);
      // ป้าย Tier ซ้าย (สีเดิมของระบบ)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(PAD, y, LABEL_W, h, [16, 0, 0, 16]);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.restore();
      const labelSize = fitFontSize(ctx, t.tier, LABEL_W - 20, 700, Math.min(t.tier.length > 1 ? 48 : 56, Math.floor(h * 0.8)), 12);
      text(ctx, t.tier, PAD + LABEL_W / 2, y + h / 2, {
        font: font(700, labelSize, "display"),
        color: c.fg,
        align: "center",
        baseline: "middle",
        maxWidth: LABEL_W - 12,
      });
      const x0 = PAD + LABEL_W + pad;
      if (t.heroes.length === 0) {
        text(ctx, "ยังไม่มีฮีโร่", x0, y + h / 2, { font: font(400, h < 44 ? 16 : 22), color: COLORS.faint, baseline: "middle" });
      }
      t.heroes.forEach((hero, k) => {
        const col = k % perRow;
        const row = Math.floor(k / perRow);
        drawHeroIcon(ctx, images, hero, x0 + col * (icon + GAP), y + pad + row * (icon + GAP), icon);
      });
      y += h + rowGap;
    });

    drawTierFooter(ctx, H, d.generatedDate);
  },
};
