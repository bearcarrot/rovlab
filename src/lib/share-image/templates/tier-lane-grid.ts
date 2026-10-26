import { readableTextColor } from "../../readableText";
import { drawBackground, drawHeroIcon, fillRound, fitFontSize, font, text } from "../draw";
import { COLORS, TIER_COLORS } from "../theme";
import type { ImageTemplate, ShareHero } from "../types";
import { drawTierFooter, drawTierHeader } from "./tier-list";
import { GAP, GRID_CELL_PAD, GRID_HEAD_H, GRID_LABEL_W, GRID_MIN_H, GRID_ROW_GAP, HEADER_H, PAD, W, planLaneGrid } from "./tierLayout";

// Tier rows x lane columns. Cells come from features/tierlist/laneGrid.ts (the same grouping as the web grid).
export interface TierLaneGridImageData {
  title: string;
  patch: string;
  filterLabel: string;
  extraLabel?: string;
  /** columns, in order */
  lanes: { code: string; label: string; icon?: string }[];
  /** color = #RRGGBB of a custom row; none = official Tier color. cells[i] = heroes of lanes[i]. */
  tiers: { tier: string; color?: string; cells: ShareHero[][]; unassigned: ShareHero[] }[];
  generatedDate: string;
}

const OTHER_LABEL = "อื่นๆ";

function planOf(d: TierLaneGridImageData) {
  const other = d.tiers.some((t) => t.unassigned.length > 0);
  const counts = d.tiers.map((t) => {
    const c = d.lanes.map((_, i) => t.cells[i]?.length ?? 0);
    if (other) c.push(t.unassigned.length);
    return c;
  });
  return { other, plan: planLaneGrid(counts, Math.max(1, d.lanes.length + (other ? 1 : 0))) };
}

export const tierLaneGridTemplate: ImageTemplate<TierLaneGridImageData> = {
  id: "tier-lane-grid",
  width: W,
  height: GRID_MIN_H,
  heightFor: (d) => planOf(d).plan.height,
  collectImageUrls: (d) => [
    ...new Set([
      ...d.lanes.flatMap((l) => (l.icon ? [l.icon] : [])),
      ...d.tiers.flatMap((t) => [...t.cells.flat(), ...t.unassigned].map((h) => h.icon)),
    ]),
  ].filter(Boolean),
  draw({ ctx, images, height }, d) {
    drawBackground(ctx, W, height);
    drawTierHeader(ctx, images, d);
    const { other, plan: p } = planOf(d);
    const cols: { label: string; icon?: string; plain?: boolean }[] = d.lanes.map((l) => ({ label: l.label, icon: l.icon }));
    if (other) cols.push({ label: OTHER_LABEL, plain: true });
    const colX = (i: number) => p.x0 + i * (p.colW + GAP);

    // lane headers (icon, or the lane's initials when the icon is missing / failed to load)
    const hh = GRID_HEAD_H - 12;
    cols.forEach((c, i) => {
      const x = colX(i);
      fillRound(ctx, x, HEADER_H, p.colW, hh, 12, COLORS.surface, COLORS.border);
      let tx = x + 12;
      if (!c.plain) {
        drawHeroIcon(ctx, images, { name: c.label, icon: c.icon ?? "" }, x + 8, HEADER_H + (hh - 36) / 2, 36, 8);
        tx = x + 8 + 36 + 8;
      }
      text(ctx, c.label, tx, HEADER_H + hh / 2, { font: font(600, 22, "display"), color: COLORS.text, baseline: "middle", maxWidth: x + p.colW - 8 - tx });
    });

    let y = p.rowsTop;
    d.tiers.forEach((t, i) => {
      const h = p.rowHeights[i];
      const c = t.color ? { bg: t.color, fg: readableTextColor(t.color) } : (TIER_COLORS[t.tier] ?? { bg: COLORS.raised, fg: COLORS.text });
      fillRound(ctx, PAD, y, W - PAD * 2, h, 16, COLORS.surface, COLORS.border);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(PAD, y, GRID_LABEL_W, h, [16, 0, 0, 16]);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.restore();
      const labelSize = fitFontSize(ctx, t.tier, GRID_LABEL_W - 20, 700, Math.min(t.tier.length > 1 ? 44 : 52, Math.floor(h * 0.8)), 12);
      text(ctx, t.tier, PAD + GRID_LABEL_W / 2, y + h / 2, {
        font: font(700, labelSize, "display"),
        color: c.fg,
        align: "center",
        baseline: "middle",
        maxWidth: GRID_LABEL_W - 12,
      });
      const cells = [...d.lanes.map((_, k) => t.cells[k] ?? []), ...(other ? [t.unassigned] : [])];
      cells.forEach((heroes, k) => {
        const x = colX(k);
        fillRound(ctx, x, y + 4, p.colW, h - 8, 10, COLORS.raised);
        heroes.forEach((hero, n) => {
          drawHeroIcon(ctx, images, hero, x + GRID_CELL_PAD + (n % p.perRow) * (p.size + GAP), y + GRID_CELL_PAD + Math.floor(n / p.perRow) * (p.size + GAP), p.size);
        });
      });
      if (cells.every((c2) => c2.length === 0)) {
        text(ctx, "ยังไม่มีฮีโร่", p.x0 + GRID_CELL_PAD, y + h / 2, { font: font(400, 20), color: COLORS.faint, baseline: "middle" });
      }
      y += h + GRID_ROW_GAP;
    });

    drawTierFooter(ctx, height, d.generatedDate);
  },
};
