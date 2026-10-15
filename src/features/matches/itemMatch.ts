import type { ItemSummary } from "@/types/item";

// Reads which items the user bought from the item icons on the scoreboard screenshot ("ประวัติการเล่น" page).
// Runs in the browser on the ORIGINAL file; nothing is uploaded and Gemini is not involved (no quota).
// Each of the 6 icon slots is compared with the catalogue icons (public.items.icon_url). A wrong guess is possible, so the
// caller always shows the result in an editable dropdown, and a slot whose best match is not clearly ahead is flagged.

// Layout of that page, measured on a 2576x1191 screenshot: centre of every item icon in the BLUE (left) team. The user's own
// row is always blue (the OCR function only ever marks a blue row as "me").
const W0 = 2576;
const H0 = 1191;
const HALF = 33;
const BLUE_X = [665, 754, 843, 933, 1022, 1111];
const ROW_Y = [333, 486, 638, 791, 943];

/** Best-vs-second distance below this means "not sure": the user is asked to check that slot. */
export const CONFIDENT_MARGIN = 0.12;

export interface ItemTemplate {
  slug: string;
  u: number[];
}
/** slug null = empty slot. margin = how far the best match is ahead of the second best (bigger = surer). */
export interface SlotGuess {
  slug: string | null;
  margin: number;
}

/**
 * How far (as a fraction) a screenshot's width/height ratio may differ from the measured one. The slot positions above are
 * scaled separately on each axis, so a wider or narrower picture moves every icon window by about (difference x width): 1.5%
 * was up to ~39 px at 2576 px wide, more than an icon's half-size (HALF = 33), which gave confident wrong guesses instead of
 * "cannot read". 0.6% is at most ~15 px. Recent iPhones (ratio about 2.164-2.174) are inside it; a 20:9 Android screen
 * (2.222) is ~2.7% off and is refused until its layout has been measured.
 */
export const LAYOUT_TOLERANCE = 0.006;

/** Other phone shapes lay the page out differently; only guess when the picture has the measured proportions. */
export const layoutFits = (w: number, h: number) => h > 0 && Math.abs(w / h / (W0 / H0) - 1) <= LAYOUT_TOLERANCE;

/** Mean-removed, unit-length copy, so brightness/contrast differences do not matter (correlation distance). */
export function unit(v: number[]): number[] {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const c = v.map((x) => x - m);
  let n = 0;
  for (const x of c) n += x * x;
  n = Math.sqrt(n) || 1;
  return c.map((x) => x / n);
}

/** v = RGB triplets of the 20x20 icon centre. An empty slot is a flat colour: tiny spread in every channel. */
export function isFlat(v: number[]): boolean {
  const px = v.length / 3;
  let spread = 0;
  for (let ch = 0; ch < 3; ch++) {
    let mean = 0;
    for (let i = ch; i < v.length; i += 3) mean += v[i];
    mean /= px;
    let q = 0;
    for (let i = ch; i < v.length; i += 3) q += (v[i] - mean) ** 2;
    spread += Math.sqrt(q / px);
  }
  return spread / 3 < 12;
}

export function guessSlot(v: number[], templates: ItemTemplate[]): SlotGuess {
  if (isFlat(v)) return { slug: null, margin: Infinity };
  const u = unit(v);
  let best = Infinity;
  let second = Infinity;
  let slug: string | null = null;
  for (const t of templates) {
    let d = 0;
    for (let i = 0; i < u.length; i++) d += u[i] * t.u[i];
    d = 1 - d;
    if (d < best) {
      second = best;
      best = d;
      slug = t.slug;
    } else if (d < second) second = d;
  }
  return { slug, margin: second - best };
}

// ---- browser-only part (canvas) ----

function makeCtx(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  return c.getContext("2d", { willReadFrequently: true })!;
}

// Both sources are drawn to 32x32 and only the 20x20 centre is compared: it skips the frame, so the catalogue icon and the
// in-game icon are compared on the artwork alone.
function iconVector(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): number[] {
  ctx.clearRect(0, 0, 32, 32);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 32, 32);
  const d = ctx.getImageData(6, 6, 20, 20).data;
  const v: number[] = [];
  for (let i = 0; i < d.length; i += 4) v.push(d[i], d[i + 1], d[i + 2]);
  return v;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the icon bucket is public with CORS, which getImageData needs
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("icon"));
    img.src = src;
  });

let templatesPromise: Promise<ItemTemplate[]> | null = null;

export function loadTemplates(items: ItemSummary[]): Promise<ItemTemplate[]> {
  templatesPromise ??= (async () => {
    const ctx = makeCtx();
    const out: ItemTemplate[] = [];
    await Promise.all(
      items
        .filter((i) => i.icon)
        .map(async (it) => {
          try {
            const img = await loadImage(it.icon);
            out.push({ slug: it.slug, u: unit(iconVector(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight)) });
          } catch {
            /* one missing icon only makes that item unguessable */
          }
        }),
    );
    return out;
  })().catch((e) => {
    templatesPromise = null; // allow retry
    throw e;
  });
  return templatesPromise;
}

/** 5 rows x 6 slots for the blue team, or null when the picture cannot be read this way. Never throws. */
export async function guessBlueRows(file: File, items: ItemSummary[]): Promise<SlotGuess[][] | null> {
  try {
    const templates = await loadTemplates(items);
    if (templates.length === 0) return null;
    const bmp = await createImageBitmap(file);
    try {
      if (!layoutFits(bmp.width, bmp.height)) return null;
      const sx = bmp.width / W0;
      const sy = bmp.height / H0;
      const ctx = makeCtx();
      return ROW_Y.map((y) =>
        BLUE_X.map((x) => guessSlot(iconVector(ctx, bmp, (x - HALF) * sx, (y - HALF) * sy, 2 * HALF * sx, 2 * HALF * sy), templates)),
      );
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}
