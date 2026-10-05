import {
  COLORS,
  FONT_BODY,
  FONT_DISPLAY,
  FORMAT_SIZE,
  canvasToBlob,
  contentRect,
  createCanvas,
  drawFrame,
  drawIcon,
  drawStar,
  ensureFonts,
  fitText,
  loadImages,
  roundRectPath,
  wrapText,
  type ImageFormat,
} from "./canvas";
import type { ImageHero } from "./tierListImage";

export interface DraftImageData {
  mine: (ImageHero | null)[];
  enemy: (ImageHero | null)[];
  physical: number; // relative damage points (not percentages)
  magic: number;
  meters: { label: string; value: number }[]; // value 0..100
  gaps: { label: string; detail: string }[];
  combos: { heroes: string; reason: string }[];
  picks: { name: string; stars: number; reason: string }[];
  modeText?: string;
}

const SLOT_GAP = 10;

type Imgs = Map<string, HTMLImageElement | null>;

function drawTeam(
  ctx: CanvasRenderingContext2D,
  label: string,
  team: (ImageHero | null)[],
  imgs: Imgs,
  x: number,
  y: number,
  slot: number,
  color: string
) {
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  ctx.font = `600 28px ${FONT_DISPLAY}`;
  ctx.fillText(label, x, y + 28);
  team.forEach((hero, i) => {
    const sx = x + i * (slot + SLOT_GAP);
    const sy = y + 40;
    if (hero) {
      drawIcon(ctx, imgs.get(hero.icon), sx, sy, slot, hero.name);
      ctx.fillStyle = COLORS.text;
      ctx.font = `500 18px ${FONT_BODY}`;
      ctx.textAlign = "center";
      ctx.fillText(fitText(ctx, hero.nameTh, slot + SLOT_GAP - 4), sx + slot / 2, sy + slot + 24);
      ctx.textAlign = "left";
    } else {
      roundRectPath(ctx, sx, sy, slot, slot, slot * 0.18);
      ctx.fillStyle = COLORS.surface;
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.faint;
      ctx.font = `600 ${Math.round(slot * 0.4)}px ${FONT_DISPLAY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", sx + slot / 2, sy + slot / 2);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }
  });
}

function drawMeters(ctx: CanvasRenderingContext2D, data: DraftImageData, x: number, y: number, w: number) {
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 26px ${FONT_DISPLAY}`;
  ctx.fillText("ภาพรวมทีมของคุณ", x, y + 26);

  // physical / magic split
  const total = data.physical + data.magic;
  const physPct = total > 0 ? Math.round((data.physical / total) * 100) : 0;
  const magPct = total > 0 ? 100 - physPct : 0;
  ctx.font = `400 20px ${FONT_BODY}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(total > 0 ? `ดาเมจกายภาพ ${physPct}%` : "ดาเมจกายภาพ", x, y + 64);
  ctx.textAlign = "right";
  ctx.fillText(total > 0 ? `ดาเมจเวท ${magPct}%` : "ดาเมจเวท", x + w, y + 64);
  ctx.textAlign = "left";
  roundRectPath(ctx, x, y + 74, w, 16, 8);
  ctx.fillStyle = COLORS.raised;
  ctx.fill();
  if (total > 0) {
    ctx.save();
    roundRectPath(ctx, x, y + 74, w, 16, 8);
    ctx.clip();
    ctx.fillStyle = COLORS.rift;
    ctx.fillRect(x, y + 74, (w * physPct) / 100, 16);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x + (w * physPct) / 100, y + 74, w - (w * physPct) / 100, 16);
    ctx.restore();
  }

  let my = y + 120;
  for (const m of data.meters) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `400 20px ${FONT_BODY}`;
    ctx.fillText(m.label, x, my + 20);
    roundRectPath(ctx, x, my + 28, w, 14, 7);
    ctx.fillStyle = COLORS.raised;
    ctx.fill();
    const fillW = (w * Math.max(0, Math.min(100, m.value))) / 100;
    if (fillW > 0) {
      ctx.save();
      roundRectPath(ctx, x, my + 28, w, 14, 7);
      ctx.clip();
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x, my + 28, fillW, 14);
      ctx.restore();
    }
    my += 52;
  }
}

// Right column: gaps / combos / next picks. Stops cleanly when there is no room left.
function drawNotes(ctx: CanvasRenderingContext2D, data: DraftImageData, x: number, y: number, w: number, bottom: number) {
  let cy = y;
  ctx.textAlign = "left";
  const title = (text: string) => {
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 26px ${FONT_DISPLAY}`;
    ctx.fillText(text, x, cy + 26);
    cy += 44;
  };
  let drewAny = false;

  if (data.gaps.length > 0 && cy + 44 + 56 <= bottom) {
    drewAny = true;
    title("จุดที่ทีมยังขาด");
    for (const g of data.gaps) {
      ctx.font = `400 18px ${FONT_BODY}`;
      const lines = wrapText(ctx, g.detail, w - 24, 2);
      const need = 28 + lines.length * 24 + 8;
      if (cy + need > bottom) break;
      ctx.fillStyle = COLORS.loss;
      ctx.beginPath();
      ctx.arc(x + 6, cy + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = `500 21px ${FONT_BODY}`;
      ctx.fillText(g.label, x + 24, cy + 20);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `400 18px ${FONT_BODY}`;
      lines.forEach((l, i) => ctx.fillText(l, x + 24, cy + 44 + i * 24));
      cy += need;
    }
    cy += 12;
  }

  if (data.combos.length > 0 && cy + 44 + 56 <= bottom) {
    drewAny = true;
    title("คอมโบในทีม");
    for (const c of data.combos) {
      ctx.font = `400 18px ${FONT_BODY}`;
      const lines = c.reason ? wrapText(ctx, c.reason, w - 24, 2) : [];
      const need = 28 + lines.length * 24 + 8;
      if (cy + need > bottom) break;
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.arc(x + 6, cy + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = `500 21px ${FONT_BODY}`;
      ctx.fillText(fitText(ctx, c.heroes, w - 24), x + 24, cy + 20);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `400 18px ${FONT_BODY}`;
      lines.forEach((l, i) => ctx.fillText(l, x + 24, cy + 44 + i * 24));
      cy += need;
    }
    cy += 12;
  }

  if (data.picks.length > 0 && cy + 44 + 56 <= bottom) {
    drewAny = true;
    title("แนะนำตัวถัดไป");
    for (const p of data.picks) {
      ctx.font = `400 18px ${FONT_BODY}`;
      const lines = p.reason ? wrapText(ctx, p.reason, w - 24, 2) : [];
      const need = 28 + lines.length * 24 + 8;
      if (cy + need > bottom) break;
      ctx.fillStyle = COLORS.text;
      ctx.font = `500 21px ${FONT_BODY}`;
      ctx.fillText(fitText(ctx, p.name, w - 24 - 5 * 22), x, cy + 20);
      for (let s = 0; s < 5; s++) {
        drawStar(ctx, x + w - 5 * 22 + s * 22 + 10, cy + 14, 9, s < p.stars ? COLORS.accent : COLORS.border);
      }
      ctx.fillStyle = COLORS.muted;
      ctx.font = `400 18px ${FONT_BODY}`;
      lines.forEach((l, i) => ctx.fillText(l, x, cy + 44 + i * 24));
      cy += need;
    }
  }

  if (!drewAny) {
    ctx.fillStyle = COLORS.faint;
    ctx.font = `400 20px ${FONT_BODY}`;
    ctx.fillText("เลือกฮีโร่เพิ่มเพื่อดูจุดที่ขาดและคำแนะนำ", x, cy + 24);
  }
}

// Draft snapshot: both teams, team overview bars, gaps/combos/next picks.
// The heuristic disclaimer is always printed (the bars come from hero roles, not skill-level data).
export async function renderDraftImage(data: DraftImageData, format: ImageFormat): Promise<Blob> {
  const { w, h } = FORMAT_SIZE[format];
  await ensureFonts();
  const heroes = [...data.mine, ...data.enemy].filter((x): x is ImageHero => x !== null);
  const imgs = await loadImages(heroes.map((x) => x.icon));

  const { canvas, ctx } = createCanvas(w, h);
  drawFrame(ctx, w, h, {
    title: "Draft ของฉัน",
    subtitle: data.modeText ?? "ทีมของฉัน vs ทีมศัตรู",
    footnote: "* ภาพรวมทีมประเมินจาก Role ของฮีโร่ (Heuristic) ไม่ใช่ข้อมูลระดับสกิล และคำแนะนำเป็นการประเมินเบื้องต้น",
  });

  const area = contentRect(w, h);
  const colGap = 24;
  const halfW = Math.floor((area.w - colGap) / 2);
  const slot = Math.min(140, Math.floor((halfW - SLOT_GAP * 4) / 5));
  const teamBlockH = 40 + slot + 34;

  drawTeam(ctx, "ทีมของคุณ", data.mine, imgs, area.x, area.y, slot, COLORS.accent);
  drawTeam(ctx, "ทีมศัตรู", data.enemy, imgs, area.x + halfW + colGap, area.y, slot, COLORS.loss);

  const lowerY = area.y + teamBlockH + 28;
  drawMeters(ctx, data, area.x, lowerY, halfW);
  drawNotes(ctx, data, area.x + halfW + colGap, lowerY, halfW, area.y + area.h);

  return canvasToBlob(canvas);
}
