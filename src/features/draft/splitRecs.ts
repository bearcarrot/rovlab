// ฮีโร่หนึ่งตัวอยู่ได้หมวดเดียว: ชนะทาง > คอมโบ > ภาพรวม
// shortcut: หมวดชนะทางตัดที่ relationLimit; ตัวที่เกินเพดานจะไปอยู่ภาพรวมแทน (ไม่หายไป)
export function splitRecs<T extends { hero: { id: string }; tags: string[] }>(
  all: T[],
  relationLimit: number,
  overallLimit: number
) {
  const used = new Set<string>();
  const take = (list: T[], limit: number) => {
    const out = list.filter((r) => !used.has(r.hero.id)).slice(0, limit);
    out.forEach((r) => used.add(r.hero.id));
    return out;
  };
  const counter = take(all.filter((r) => r.tags.includes("counter")), relationLimit);
  const synergy = take(all.filter((r) => r.tags.includes("synergy")), relationLimit);
  const overall = take(all, overallLimit);
  return { counter, synergy, overall };
}
