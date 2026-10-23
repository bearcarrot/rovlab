import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { BuildSpellEditor } from "@/features/admin/BuildSpellEditor";
import { BuildEnchantmentEditor } from "@/features/admin/BuildEnchantmentEditor";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useToast } from "@/components/ui/toast";
import { db, Row, RefOpt, TAG_STYLES_TABLE, heroName, CFG } from "@/features/admin/adminConfig";
import { arrOr, Editor } from "@/features/admin/AdminEditor";
import { BuildManagementView } from "@/features/admin/BuildManagementView";

// แท็บที่มีหน้าจอของตัวเอง (ไม่ใช่ตารางแบบ CFG): แสดงต่อท้ายแถบแท็บ ถัดจาก "รูนในบิลด์" ตามลำดับด้านล่าง
const CUSTOM_TABS: Record<string, { label: string; after: string; render: () => ReactNode }> = {
  buildSpell: { label: "สกิลชาเลนเจอร์ในบิลด์", after: "buildRune", render: () => <BuildSpellEditor /> },
  buildEnchant: { label: "พลังแฝงในบิลด์", after: "buildSpell", render: () => <BuildEnchantmentEditor /> },
};
// กลุ่มแท็บ: "build" = หน้า Build Management (บิลด์ + 4 ตัวแก้ไขในบิลด์) / "rest" = แท็บที่เหลือในโหมด "แก้ไขข้อมูล"
const BUILD_TAB_KEYS = ["builds", "buildItems", "buildRune", "buildSpell", "buildEnchant"];
// ไอเทม/รูน แก้ได้ที่โหมด "ฐานข้อมูลเกม" แล้ว จึงไม่แสดงเป็นชิปในโหมด "แก้ไขข้อมูล" (ยังใช้ CFG ตัวเดิมเป็นข้อมูลอ้างอิงให้หน้าบิลด์)
// synergies (ซินเนอร์จี้ 2 ตัว) ได้ถูกแทนที่ด้วยโหมด "Combo" (user_combos รองรับ 2–5 ตัว) และหน้าฮีโร่อ่านจาก Combo แล้ว — ซ่อนไว้กันแก้ผิดที่
// (ตาราง hero_synergies ยังเก็บไว้เป็นข้อมูลสำรอง)
const HIDDEN_TAB_KEYS = ["items", "rune", "synergies"];
const isCustomTab = (k: string) => Object.prototype.hasOwnProperty.call(CUSTOM_TABS, k);
// ลำดับแท็บทั้งหมด: ตาราง CFG ตามเดิม โดยแท็บ custom แทรกต่อจากแท็บที่ระบุใน `after`
const TAB_KEYS: string[] = (() => {
  const keys = Object.keys(CFG);
  for (const [k, c] of Object.entries(CUSTOM_TABS)) {
    const at = keys.indexOf(c.after);
    keys.splice(at < 0 ? keys.length : at + 1, 0, k);
  }
  return keys;
})();

export function Admin({ group = "rest" }: { group?: "build" | "rest" }) {
  const { user, loading } = useAuth();
  const { isAdmin, checking, error } = useIsAdmin();
  const toast = useToast();
  // แท็บที่เปิดอยู่จำไว้ด้วย รีเฟรชแล้วกลับมาที่แท็บเดิมพร้อมตัวกรองที่เลือกไว้
  const keys = useMemo(() => TAB_KEYS.filter((k) => !HIDDEN_TAB_KEYS.includes(k) && BUILD_TAB_KEYS.includes(k) === (group === "build")), [group]);
  const [savedTab, setTab] = usePersistedState<string>(group === "build" ? "admin:tab:build" : "admin:tab", keys[0]);
  const tab = keys.includes(savedTab) ? savedTab : keys[0];
  const [refs, setRefs] = useState<Record<string, RefOpt[]>>({});
  const navRef = useRef<HTMLElement>(null);

  // รีเฟรชแล้วแท็บที่จำไว้อาจอยู่นอกจอ (แถบแท็บเลื่อนแนวนอนบนมือถือ) เลื่อนให้แท็บที่เปิดอยู่มาอยู่กลางแถบ
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [tab, isAdmin]);

  // โหลดตัวเลือกสำหรับช่องที่อ้างอิงตารางอื่น (ฮีโร่/ไอเทม/รูน/แพตช์/หมวดคู่มือ) พร้อมไอคอน (ถ้ามี) ไว้แสดงในการ์ดและช่องเลือก
  // โหลดใหม่ทุกครั้งที่สลับแท็บ เพื่อให้หมวดที่เพิ่ง เพิ่ม/แก้ ในแท็บ "หมวดคู่มือ" โผล่ในช่องเลือกของแท็บ "คู่มือ" ทันที
  useEffect(() => {
    if (!isAdmin) return;
    // มีตัวเลือกชุดไหนโหลดพลาดหรือไม่ — แจ้งครั้งเดียวตอนจบ แทนที่จะเด้ง toast ทีละชุด
    const state = { failed: false };
    const opt = (
      table: string,
      sel: string,
      order: string,
      asc: boolean,
      label: (r: Row) => string,
      icon?: (r: Row) => string | undefined,
      alt?: (r: Row) => string | undefined,
      extra?: (r: Row) => Partial<RefOpt>
    ) =>
      db
        .from(table)
        .select(sel)
        .order(order, { ascending: asc })
        .then(({ data, error }: { data: Row[] | null; error: unknown }) => {
          if (error) state.failed = true;
          return (data ?? []).map((r) => ({ id: r.id as string, label: label(r), icon: icon?.(r), alt: alt?.(r), ...extra?.(r) }));
        });
    // รูนเก็บสีไว้ด้วย เพื่อใช้คำนวณจำนวนช่องต่อสีในแท็บ "รูนในบิลด์"
    const runeOpts = db
      .from("rune")
      .select("id,name,color,icon_url")
      .order("name", { ascending: true })
      .then(({ data, error }: { data: Row[] | null; error: unknown }) => {
        if (error) state.failed = true;
        return (data ?? []).map((r) => ({
          id: r.id as string,
          label: r.name as string,
          color: (r.color ?? undefined) as string | undefined,
          icon: (r.icon_url ?? undefined) as string | undefined,
        }));
      });
    void Promise.all([
      // ชื่อไทยเก็บเป็น alt ไว้ใช้ค้นหาอย่างเดียว (ยังแสดงชื่ออังกฤษเหมือนเดิม)
      // roles / lanes ไว้ให้ชิปกรองในแท็บสถิติและ Tier List
      opt(
        "heroes",
        "id,name,name_th,icon_url,roles,lanes,role,lane",
        "name",
        true,
        heroName,
        (r) => r.icon_url ?? undefined,
        (r) => (r.name_th as string | null) ?? undefined,
        (r) => ({ roles: arrOr(r.roles, r.role), lanes: arrOr(r.lanes, r.lane) })
      ),
      // ไอเทมในบิลด์แสดงชื่ออังกฤษ (ตรงกับเกม/เว็บทางการ) ชื่อไทยใน DB เป็นการแปลเครื่อง
      opt(
        "items",
        "id,name,icon_url,tier,cost,role_tags,stats",
        "name",
        true,
        (r) => r.name ?? "?",
        (r) => r.icon_url ?? undefined,
        undefined,
        (r) => ({
          tier: (r.tier ?? undefined) as number | undefined,
          cost: (r.cost ?? undefined) as number | undefined,
          tags: Array.isArray(r.role_tags) ? (r.role_tags as string[]) : [],
          stat: Array.isArray(r.stats) ? (r.stats as string[]).join(" · ") : undefined,
        })
      ),
      runeOpts,
      opt("patches", "id,code", "released_at", false, (r) => r.code),
      // หมวดคู่มือ ใช้เป็นตัวเลือกของช่อง "หมวดหมู่" ในแท็บ "คู่มือ" (เรียงตาม sort_id เหมือนที่แสดงบนเว็บ)
      opt("guide_categories", "id,name_th,slug,sort_id", "sort_id", true, (r) => r.name_th ?? r.slug ?? "?"),
      // รายการแท็กสกิล (ชื่อ + สี + type ของเกม) ใช้เป็นปุ่มเลือกในช่อง "แท็กสกิล" ของแท็บ "สกิล"
      // ตารางยังไม่มี = รายการว่าง (ช่องแท็กจะบอกให้ไปเพิ่มที่แท็บ "แท็กและสี")
      opt(
        TAG_STYLES_TABLE,
        "id,name,tag_type,color",
        "tag_type",
        true,
        (r) => r.name ?? "?",
        undefined,
        undefined,
        (r) => ({ color: (r.color ?? undefined) as string | undefined, tagType: (r.tag_type ?? undefined) as number | undefined })
      ),
    ])
      .then(([hero, item, rune, patch, guideCat, effectTag]) => {
        setRefs({ hero, item, rune, patch, guideCat, effectTag });
        if (state.failed) toast.error("โหลดตัวเลือกบางรายการไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
      })
      .catch(() => toast.error("โหลดตัวเลือกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองรีเฟรชหน้านี้"));
  }, [isAdmin, tab, toast]);

  if (loading || checking) return <p className="text-text-muted">กำลังตรวจสอบสิทธิ์...</p>;
  if (!user)
    return (
      <p>
        ต้อง <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> ก่อน แล้วกลับมาที่ /admin
      </p>
    );
  if (!isAdmin) return <p className="text-loss">บัญชีนี้ไม่มีสิทธิ์แอดมิน {error && `(${error})`}</p>;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">RoV LAB Admin</h1>

      {/* แท็บ: มือถือเลื่อนแนวนอน (relative เพื่อให้คำนวณตำแหน่งเลื่อนได้) เดสก์ท็อปขึ้นบรรทัดใหม่ */}
      {group !== "build" && (
      <nav
        ref={navRef}
        aria-label="ตาราง"
        className="relative overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-current={k === tab ? "page" : undefined}
              className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition ${
                k === tab
                  ? "border-accent bg-accent font-medium text-accent-fg"
                  : "border-border bg-bg-surface text-text-muted hover:border-text-faint hover:text-text"
              }`}
            >
              {isCustomTab(k) ? CUSTOM_TABS[k].label : CFG[k].label}
            </button>
          ))}
        </div>
      </nav>
      )}

      {group === "build" ? <BuildManagementView refs={refs} /> : isCustomTab(tab) ? <div key={tab}>{CUSTOM_TABS[tab].render()}</div> : <Editor key={tab} id={tab} cfg={CFG[tab]} refs={refs} />}
    </div>
  );
}
