// โหลดฟอนต์ให้ครบก่อนวาด Canvas — ถ้าวาดก่อน ข้อความไทยจะใช้ฟอนต์สำรองและแก้กลับไม่ได้
// document.fonts.ready อย่างเดียวไม่พอ: ฟอนต์ที่ยังไม่ถูกใช้ใน DOM จะไม่ถูกโหลด ต้องสั่ง load() ทีละน้ำหนักเอง

export interface FontSpec {
  family: string;
  weight: number;
}

export const SHARE_FONTS: FontSpec[] = [
  { family: "Kanit", weight: 500 },
  { family: "Kanit", weight: 600 },
  { family: "Kanit", weight: 700 },
  { family: "IBM Plex Sans Thai", weight: 400 },
  { family: "IBM Plex Sans Thai", weight: 500 },
  { family: "IBM Plex Sans Thai", weight: 600 },
];

// ตัวอย่างข้อความไทย + ละติน เพื่อให้ unicode-range ของ Google Fonts ดึงไฟล์ subset ที่ใช้จริงมาครบ
const SAMPLE = "กขคงจฉชซญฎฏทธนบปผฝพภมยรลวศษสหอฮ ะาิีึืุูเแโใไ่้๊๋ ABCxyz 0123456789 ★";

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      }
    );
  });
}

/** คืน true เมื่อฟอนต์ทุกตัวพร้อม; false = ใช้ฟอนต์สำรองแทนบางตัว (ไม่ throw) */
export async function ensureFonts(specs: FontSpec[] = SHARE_FONTS, timeoutMs = 6000): Promise<boolean> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts) return false;
  const loads = specs.map((s) => fonts.load(`${s.weight} 32px "${s.family}"`, SAMPLE));
  await withTimeout(Promise.all(loads), timeoutMs, []);
  await withTimeout(fonts.ready, timeoutMs, fonts);
  return specs.every((s) => fonts.check(`${s.weight} 32px "${s.family}"`, SAMPLE));
}
