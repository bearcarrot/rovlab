import {
  COLORS,
  CONTENT_TOP,
  FONT_BODY,
  FONT_DISPLAY,
  FOOTER_RESERVED,
  FORMAT_SIZE,
  MARGIN,
  TIER_COLORS,
  canvasToBlob,
  createCanvas,
  drawFrame,
  drawIcon,
  ensureFonts,
  loadImages,
  roundRectPath,
  type ImageFormat,
} from "./canvas";

export interface ImageHero {
  name: string;
  nameTh: string;
  icon: string;
}

export interface TierImageRow {
  tier: string;
  heroes: ImageHero[];
}

export interface TierImageData {
  title: string;
  subtitle: string;
  footnote?: string;
  rows: TierImageRow[];
}

const GAP = 8;
const PAD = 12;
const ROW_GAP = 12;
const LABEL_GAP = 12;
const MIN_SIZE = 40;
const MAX_SIZE = 120;

// Tier rows (S+ → C) with hero icons. Icon size shrinks until everything fits the chosen format;
// if even the smallest size doesn't fit, the image grows taller instead of cutting heroes off.
export async function renderTierListImage(data: TierImageData, format: ImageFormat): Promise<Blob> {
  const rows = data.rows.filter((r) => r.heroes.length > 0);
  const base = FORMAT_SIZE[format];
  const w = base.w;
  const labelW = format === "portrait" ? 96 : 120;
  const contentW = w - MARGIN * 2;
  const areaW = contentW - labelW - LABEL_GAP - PAD * 2;
  const availH = base.h - CONTENT_TOP - FOOTER_RESERVED;

  const layout = (size: number) => {
    const perRow = Math.max(1, Math.floor((areaW + GAP) / (size + GAP)));
    const heights = rows.map((r) => Math.ceil(r.heroes.length / perRow) * (size + GAP) - GAP + PAD * 2);
    const total = heights.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, rows.length - 1);
    return { perRow, heights, total };
  };
  let size = MAX_SIZE;
  let lay = layout(size);
  while (lay.total > availH && size > MIN_SIZE) {
    size -= 2;
    lay = layout(size);
  }
  const h = Math.max(base.h, CONTENT_TOP + lay.total + FOOTER_RESERVED);

  await ensureFonts();
  const imgs = await loadImages(rows.flatMap((r) => r.heroes.map((x) => x.icon)));

  const { canvas, ctx } = createCanvas(w, h);
  drawFrame(ctx, w, h, { title: data.title, subtitle: data.subtitle, footnote: data.footnote });

  if (rows.length === 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 30px ${FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.fillText("ไม่พบฮีโร่ตามตัวกรอง", w / 2, CONTENT_TOP + 120);
    return canvasToBlob(canvas);
  }

  let y = CONTENT_TOP;
  rows.forEach((row, i) => {
    const rowH = lay.heights[i];
    const areaX = MARGIN + labelW + LABEL_GAP;

    // heroes area
    roundRectPath(ctx, areaX, y, areaW + PAD * 2, rowH, 16);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();

    // tier label
    roundRectPath(ctx, MARGIN, y, labelW, rowH, 16);
    ctx.fillStyle = TIER_COLORS[row.tier] ?? COLORS.muted;
    ctx.fill();
    ctx.fillStyle = COLORS.accentFg;
    ctx.font = `700 ${Math.min(60, Math.round(labelW * 0.55))}px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(row.tier, MARGIN + labelW / 2, y + rowH / 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // icons
    row.heroes.forEach((hero, j) => {
      const col = j % lay.perRow;
      const r = Math.floor(j / lay.perRow);
      drawIcon(ctx, imgs.get(hero.icon), areaX + PAD + col * (size + GAP), y + PAD + r * (size + GAP), size, hero.name);
    });

    y += rowH + ROW_GAP;
  });

  return canvasToBlob(canvas);
}
