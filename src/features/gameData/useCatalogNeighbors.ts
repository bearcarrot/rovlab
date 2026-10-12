import { useMemo } from "react";
import {
  getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells,
  type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell, type EnchantmentTree,
} from "@/services/gameCatalog";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { catalogPath } from "@/features/build/buildView";
import { FILTER_KEYS, enchantmentGroups, flattenEnchantmentGroups, flattenItemGroups, itemGroups, runeList, spellList } from "./catalogOrder";

export type CatalogKind = "items" | "runes" | "spells" | "enchantments";

export type CatalogNeighbors = {
  prev: { to: string; name: string };
  next: { to: string; name: string };
  /** ลำดับของรายการปัจจุบันในลิสต์ (เริ่มที่ 0) */
  index: number;
  total: number;
  /** true = ลิสต์ถูกกรองด้วยตัวกรองที่เลือกไว้ในหน้ารายการ */
  filtered: boolean;
};

type Entry = { id: string; key: string; name: string };
type Loaded =
  | { k: "items"; items: CatalogItem[] }
  | { k: "runes"; runes: CatalogRune[] }
  | { k: "spells"; spells: CatalogSpell[] }
  | { k: "enchantments"; data: { trees: EnchantmentTree[]; list: CatalogEnchantment[] } };

// หารายการก่อนหน้า/ถัดไปของรายการนี้ ตามตัวกรอง chip ที่เลือกไว้ในหน้าคลังข้อมูลเกม (เหมือน useHeroNeighbors)
// ลำดับเดียวกับที่หน้ารายการแสดง (ใช้ฟังก์ชันใน catalogOrder ร่วมกัน) วนต้น-ท้าย
// ถ้ารายการนี้ไม่อยู่ในตัวกรอง (เช่น เปิดจากลิงก์แชร์) จะใช้ลิสต์ทั้งหมดแทน; ไม่รวมช่องค้นหา (เหมือนหน้าฮีโร่)
export function useCatalogNeighbors(kind: CatalogKind | undefined, key: string): CatalogNeighbors | null {
  const [itemType] = usePersistedState<string>(FILTER_KEYS.itemType, "");
  const [itemTier] = usePersistedState<string>(FILTER_KEYS.itemTier, "");
  const [runeColor] = usePersistedState<string>(FILTER_KEYS.runeColor, "");
  const [enchTree] = usePersistedState<string>(FILTER_KEYS.enchTree, "");
  const [enchTier] = usePersistedState<string>(FILTER_KEYS.enchTier, "");

  // loader ใน services ใช้ once() จึงแชร์แคชกับหน้าอื่น ไม่ยิงซ้ำ
  const loaded = useAsync(async (): Promise<Loaded | null> => {
    if (kind === "items") return { k: "items", items: await getCatalogItems() };
    if (kind === "runes") return { k: "runes", runes: await getCatalogRunes() };
    if (kind === "spells") return { k: "spells", spells: await getCatalogSpells() };
    if (kind === "enchantments") return { k: "enchantments", data: await getCatalogEnchantments() };
    return null;
  }, [kind]);
  const d = loaded.status === "success" ? loaded.data : null;

  return useMemo(() => {
    if (!d || !kind) return null;
    const build = (f: boolean): Entry[] => {
      switch (d.k) {
        case "items":
          return flattenItemGroups(itemGroups(d.items, { q: "", type: f ? itemType : "", tier: f ? itemTier : "" })).map((i) => ({ id: i.slug.toLowerCase(), key: i.slug, name: i.name }));
        case "runes":
          return runeList(d.runes, { q: "", color: f ? runeColor : "" }).map((r) => ({ id: r.name.toLowerCase(), key: r.name, name: r.name }));
        case "spells":
          return spellList(d.spells, { q: "" }).map((s) => ({ id: s.slug.toLowerCase(), key: s.slug, name: s.name || s.nameTh }));
        case "enchantments":
          return flattenEnchantmentGroups(enchantmentGroups(d.data, { q: "", tree: f ? enchTree : "", tier: f ? enchTier : "" })).map((e) => ({ id: e.slug.toLowerCase(), key: e.slug, name: e.name || e.nameTh }));
      }
    };
    const filteredList = build(true);
    const all = build(false);
    const want = key.toLowerCase();
    const inFilter = filteredList.some((e) => e.id === want);
    const list = inFilter ? filteredList : all;
    const index = list.findIndex((e) => e.id === want);
    if (index === -1 || list.length < 2) return null;
    const at = (n: number) => {
      const e = list[(n + list.length) % list.length];
      return { to: catalogPath(kind, e.key), name: e.name };
    };
    return { prev: at(index - 1), next: at(index + 1), index, total: list.length, filtered: inFilter && list.length !== all.length };
  }, [d, kind, key, itemType, itemTier, runeColor, enchTree, enchTier]);
}
