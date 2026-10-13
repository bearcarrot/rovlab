import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Thumb } from "@/features/admin/ImageSelect";
import { useAsync } from "@/hooks/useAsync";
import { getCatalogEnchantments } from "@/services/gameCatalog";

// พาหนะแสดงบิลด์แบบอ่านอย่างเดียว จัดวางแบบหน้าจอบิลด์ในเกม: ไอเทม / พลังแฝง / รูน / สกิล
// ใช้ร่วมกันทั้งบิลด์แนะนำ และบิลด์ของผู้ใช้ — ทุกชิ้นกดแล้วไปหน้าคลังข้อมูลของชิ้นนั้น
// ชื่อไอเทม/พลังแฝง/รูน/สกิลแสดงเป็นชื่ออังกฤษในเกม (คอลัมน์ name) ให้ตรงกับที่ Coach AI ใช้

export type Phase = "early" | "core" | "situational";
export const PHASES: { k: Phase; label: string }[] = [
  { k: "early", label: "ต้นเกม" },
  { k: "core", label: "ไอเทมหลัก" },
  { k: "situational", label: "ตามสถานการณ์" },
];
export const RUNE_COLOR_VIEW = [
  { k: "red", label: "แดง", hex: "#ef4444" },
  { k: "purple", label: "ม่วง", hex: "#a855f7" },
  { k: "green", label: "เขียว", hex: "#22c55e" },
] as const;
// ประเภทไอเทม (ค่าใน items.role_tags) ใช้ทั้งชิปกรองฝั่งแอดมินและกริดเลือกไอเทมของตัวสร้างบิลด์
export const ITEM_TYPE_CHOICES = [
  { value: "physical", label: "โจมตี" },
  { value: "magic", label: "เวท" },
  { value: "defense", label: "ป้องกัน" },
  { value: "boots", label: "เคลื่อนที่" },
  { value: "jungle", label: "ป่า" },
  { value: "support", label: "ซัพพอร์ต" },
];

export interface ViewItem { slug: string; name: string; nameTh?: string; icon?: string; phase: Phase; reason?: string }
export interface ViewRune { key: string; name: string; icon?: string; color?: string; quantity: number; description?: string }
export interface ViewSpell { slug: string; name: string; nameTh: string; icon?: string; cooldownSeconds: number | null }
export interface ViewEnchant { slug: string; name: string; nameTh: string; icon?: string; tier: number | null; type: "primary" | "secondary" }
export interface ViewBuild { items: ViewItem[]; runes: ViewRune[]; spell: ViewSpell | null; enchantments: ViewEnchant[] }

export type CatalogKind = "items" | "runes" | "spells" | "enchantments";
// key: items/spells/enchantments = slug, runes = ชื่อรูน (ตาราง rune ไม่มี slug)
export const catalogPath = (kind: CatalogKind, key: string) => `/game-data/${kind}/${encodeURIComponent(key)}`;

const ROMAN = ["", "I", "II", "III"];
const KNOWN_COLORS: Set<string> = new Set(RUNE_COLOR_VIEW.map((c) => c.k));

// รายการบิลด์แสดง ReadOnlyBuild หลายอันพร้อมกัน — โหลดแคตตาล็อกพลังแฝงครั้งเดียวแล้วใช้ซ้ำ (ล้มเหลวแล้วลองใหม่ได้)
let enchantCatalog: ReturnType<typeof getCatalogEnchantments> | null = null;
const loadEnchantCatalog = () =>
  (enchantCatalog ??= getCatalogEnchantments().catch((e) => {
    enchantCatalog = null;
    throw e;
  }));

// ความสูงพื้นที่ไอคอนพลังแฝง (ให้เส้นเชื่อมอยู่กลางไอคอนทุกขนาด) — เพชร Tier 3 หมุน 45° เลยต้องเผื่อเป็นแนวทแยง
const NODE_AREA = "h-[4.5rem]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border border-border bg-bg-surface px-4 py-3">
      <h3 className="mb-3 font-display text-sm text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Tier({ tier }: { tier: number | null }) {
  if (!tier || !ROMAN[tier]) return <span className="h-3.5" />;
  return <span className="text-[10px] font-semibold leading-none text-text-muted">{ROMAN[tier]}</span>;
}

// ขนาดไอคอนวงกลม: Tier 1 และ Tier 2 ขนาดเท่ากัน (ชุดรองเล็กกว่าชุดหลัก); Tier 3 เป็นเพชร keystone แยกต่างหาก
const circleSize = (secondary: boolean) => (secondary ? "h-9 w-9" : "h-12 w-12");

// โนดพลังแฝง: วงกลมไม่มีกรอบสี หรือเพชร (keystone) ที่ยังมีกรอบทองให้ต่างจากโนดทั่วไป พร้อมเลขระดับใต้ไอคอน
function EnchantNode({ e, keystone, secondary }: { e: ViewEnchant; keystone: boolean; secondary: boolean }) {
  return (
    <Link to={catalogPath("enchantments", e.slug)} title={e.name} aria-label={e.name} className="flex flex-col items-center gap-1.5 transition hover:brightness-125">
      <span className={`flex ${NODE_AREA} items-center justify-center`}>
        {keystone ? (
          <span className="flex h-12 w-12 rotate-45 items-center justify-center overflow-hidden rounded-md border-2 border-accent bg-bg-raised">
            <span className="-rotate-45 scale-[1.45]">
              <Thumb src={e.icon} label={e.name} className="h-10 w-10 !rounded-none !border-0" />
            </span>
          </span>
        ) : (
          <span className={`flex ${circleSize(secondary)} items-center justify-center overflow-hidden rounded-[50%] bg-bg-raised`}>
            <Thumb src={e.icon} label={e.name} round className="h-full w-full !border-0" />
          </span>
        )}
      </span>
      <Tier tier={e.tier} />
    </Link>
  );
}

// สรุปรูนตามสี (จำนวนมาจาก quantity จริงเท่านั้น) — ไม่คำนวณ "เลเวลรวม" เพราะข้อมูลเลเวลรูนยังไม่มีในฐานข้อมูล
type RuneGroup = { k: string; label: string; hex: string; list: ViewRune[] };
function runeGroups(runes: ViewRune[]): (RuneGroup & { count: number })[] {
  const groups: RuneGroup[] = RUNE_COLOR_VIEW.map((c) => ({ k: c.k, label: c.label, hex: c.hex, list: runes.filter((r) => r.color === c.k) }));
  const other = runes.filter((r) => !r.color || !KNOWN_COLORS.has(r.color));
  if (other.length > 0) groups.push({ k: "other", label: "อื่น ๆ", hex: "#8b909b", list: other });
  return groups.map((g) => ({ ...g, count: g.list.reduce((n, r) => n + r.quantity, 0) }));
}

function RuneDialog({ runes, open, onOpenChange }: { runes: ViewRune[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const groups = runeGroups(runes).filter((g) => g.list.length > 0);
  const total = groups.reduce((n, g) => n + g.count, 0);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        {/* มือถือ = bottom sheet, จอใหญ่ = กล่องกลางจอ */}
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] space-y-4 overflow-y-auto rounded-t-card border border-border bg-bg-surface p-4 shadow-card focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-base font-semibold">Runes</Dialog.Title>
              <Dialog.Description className="text-xs text-text-faint">รวม {total} รูน · รายละเอียดตามข้อมูลในคลังที่ตรวจสอบแล้ว</Dialog.Description>
            </div>
            <Dialog.Close className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised" aria-label="ปิด">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {groups.map((g) => (
            <section key={g.k} aria-label={g.label} className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium text-text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.hex }} />
                {g.label} ×{g.count}
              </p>
              {g.list.map((r) => (
                <Link key={r.key} to={catalogPath("runes", r.name)} onClick={() => onOpenChange(false)} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-2.5 hover:border-accent/40">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[50%] bg-bg">
                    <Thumb src={r.icon} label={r.name} round className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-sm font-medium">{r.name}</span>
                      <span className="shrink-0 text-xs font-semibold">×{r.quantity}</span>
                    </span>
                    {r.description && <span className="mt-0.5 block whitespace-pre-line text-xs text-text-muted">{r.description}</span>}
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ReadOnlyBuild({ build }: { build: ViewBuild }) {
  const catalog = useAsync(() => loadEnchantCatalog(), []);
  const [runeOpen, setRuneOpen] = useState(false);
  const keystones = new Set<string>(catalog.status === "success" ? catalog.data.list.filter((x) => x.category === "keystone").map((x) => x.slug) : []);

  const primary = build.enchantments.filter((e) => e.type === "primary");
  const secondary = build.enchantments.filter((e) => e.type === "secondary");
  const reasons = build.items.filter((i) => i.reason);

  const groups = runeGroups(build.runes);
  const orderedRunes = groups.flatMap((g) => g.list);
  const totalRunes = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className="space-y-3">
      <Panel title="ไอเทม">
        <div className="space-y-3">
          {PHASES.map(({ k, label }) => {
            const list = build.items.filter((i) => i.phase === k);
            if (list.length === 0) return null;
            return (
              <div key={k}>
                <p className="mb-1.5 text-xs font-medium text-text-faint">{label}</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {list.map((i) => (
                    <Link
                      key={i.slug}
                      to={catalogPath("items", i.slug)}
                      title={i.name}
                      aria-label={i.name}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-border bg-bg-raised transition hover:border-accent/60 sm:h-16 sm:w-16"
                    >
                      <Thumb src={i.icon} label={i.name} className="h-full w-full !rounded-none !border-0" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-text-muted">
            {reasons.map((i) => (
              <li key={i.slug}>
                <Link to={catalogPath("items", i.slug)} className="font-medium text-text hover:text-accent">{i.name}</Link>: {i.reason}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {build.enchantments.length > 0 && (
        <Panel title="พลังแฝง">
          <div className="flex w-full items-start">
            <div className="flex min-w-0 flex-1 items-start">
              {primary.map((e, i) => (
                <Fragment key={e.slug}>
                  {i > 0 && (
                    <span className={`flex ${NODE_AREA} min-w-3 flex-1 items-center`} aria-hidden>
                      <span className="h-0.5 w-full bg-accent/50" />
                    </span>
                  )}
                  <EnchantNode e={e} keystone={keystones.has(e.slug)} secondary={false} />
                </Fragment>
              ))}
            </div>
            {primary.length > 0 && secondary.length > 0 && <span className={`mx-3 ${NODE_AREA} w-px shrink-0 bg-border`} aria-hidden />}
            <div className="flex shrink-0 items-start gap-2 sm:gap-3">
              {secondary.map((e) => (
                <EnchantNode key={e.slug} e={e} keystone={false} secondary />
              ))}
            </div>
          </div>
        </Panel>
      )}

      {build.runes.length > 0 && (
        <Panel title="รูน">
          <button type="button" onClick={() => setRuneOpen(true)} aria-label="ดูรายละเอียดรูน" className="block w-full rounded-lg text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span className="flex flex-wrap items-start gap-4">
              {orderedRunes.map((r) => (
                <span key={r.key} className="flex flex-col items-center" title={r.name}>
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[50%] bg-bg-raised">
                    <Thumb src={r.icon} label={r.name} round className="h-full w-full" />
                  </span>
                  <span className="-mt-2 rounded-full border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold leading-none">×{r.quantity}</span>
                </span>
              ))}
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-text-muted">
              {groups.filter((g) => g.count > 0).map((g) => (
                <span key={g.k} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.hex }} />
                  {g.label} {g.count}
                </span>
              ))}
              <span className="font-medium text-text">รวม {totalRunes}</span>
            </span>
          </button>
          <RuneDialog runes={build.runes} open={runeOpen} onOpenChange={setRuneOpen} />
        </Panel>
      )}

      {build.spell && (
        <Panel title="สกิล">
          <Link to={catalogPath("spells", build.spell.slug)} title={build.spell.name} aria-label={build.spell.name} className="inline-flex items-center gap-3 transition hover:brightness-125">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[50%] border-2 border-border bg-bg-raised">
              <Thumb src={build.spell.icon} label={build.spell.name} round className="h-full w-full" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{build.spell.name}</span>
              {build.spell.cooldownSeconds != null && <span className="block text-xs text-text-faint">CD {build.spell.cooldownSeconds}s</span>}
            </span>
          </Link>
        </Panel>
      )}
    </div>
  );
}
