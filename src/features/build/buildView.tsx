import { Link } from "react-router-dom";
import { Thumb } from "@/features/admin/ImageSelect";

// พาหนะแสดงบิลด์แบบอ่านอย่างเดียว (ใช้สล็อตหน้าตาเดียวกับฝั่งแอดมิน) ใช้ร่วมกันทั้งบิลด์แนะนำ และบิลด์ของผู้ใช้
// ทุกช่องกดแล้วไปหน้าคลังข้อมูลของชิ้นนั้น

export type Phase = "early" | "core" | "situational";
export const PHASES: { k: Phase; label: string }[] = [
  { k: "early", label: "ช่วงต้นเกม" },
  { k: "core", label: "ไอเทมหลัก" },
  { k: "situational", label: "ตามสถานการณ์" },
];
export const RUNE_COLOR_VIEW = [
  { k: "red", label: "แดง", hex: "#ef4444" },
  { k: "purple", label: "ม่วง", hex: "#a855f7" },
  { k: "green", label: "เขียว", hex: "#22c55e" },
] as const;

export interface ViewItem { slug: string; name: string; icon?: string; phase: Phase; reason?: string }
export interface ViewRune { key: string; name: string; icon?: string; color?: string; quantity: number }
export interface ViewSpell { slug: string; name: string; nameTh: string; icon?: string; cooldownSeconds: number | null }
export interface ViewEnchant { slug: string; name: string; nameTh: string; icon?: string; tier: number | null; type: "primary" | "secondary" }
export interface ViewBuild { items: ViewItem[]; runes: ViewRune[]; spell: ViewSpell | null; enchantments: ViewEnchant[] }

export type CatalogKind = "items" | "runes" | "spells" | "enchantments";
// key: items/spells/enchantments = slug, runes = ชื่อรูน (ตาราง rune ไม่มี slug)
export const catalogPath = (kind: CatalogKind, key: string) => `/game-data/${kind}/${encodeURIComponent(key)}`;

const heading = "mb-2 text-xs font-medium text-text-faint";

export function ReadOnlyBuild({ build }: { build: ViewBuild }) {
  const primary = build.enchantments.filter((e) => e.type === "primary");
  const secondary = build.enchantments.filter((e) => e.type === "secondary");
  const reasons = build.items.filter((i) => i.reason);
  const knownColors = new Set<string>(RUNE_COLOR_VIEW.map((c) => c.k));
  const otherRunes = build.runes.filter((r) => !r.color || !knownColors.has(r.color));

  const runeRow = (label: string, hex: string | null, runes: ViewRune[]) => {
    const slots = runes.flatMap((r) => Array.from({ length: Math.max(1, r.quantity) }, () => r));
    if (slots.length === 0) return null;
    return (
      <div key={label}>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-faint">
          {hex && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />}
          {label}
          <span>{slots.length}</span>
        </p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {slots.map((r, i) => (
            <Link
              key={`${r.key}-${i}`}
              to={catalogPath("runes", r.name)}
              title={r.name}
              aria-label={r.name}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-[50%] border-2 bg-bg-surface transition hover:brightness-125"
              style={{ borderColor: hex ?? "#5C616D" }}
            >
              <Thumb src={r.icon} label={r.name} round className="h-full w-full" />
            </Link>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-text-faint">{runes.map((r) => `${r.name}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`).join(" · ")}</p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <section aria-label="ไอเทมในบิลด์" className="space-y-4">
        {PHASES.map(({ k, label }) => {
          const list = build.items.filter((i) => i.phase === k);
          if (list.length === 0) return null;
          return (
            <div key={k}>
              <p className={heading}>{label}</p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {list.map((i) => (
                  <Link
                    key={i.slug}
                    to={catalogPath("items", i.slug)}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-bg-surface text-center transition hover:border-accent/40"
                  >
                    <Thumb src={i.icon} label={i.name} className="h-10 w-10" />
                    <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{i.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {reasons.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-muted">
            {reasons.map((i) => (
              <li key={i.slug}>
                <Link to={catalogPath("items", i.slug)} className="font-medium text-text hover:text-accent">{i.name}</Link>: {i.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      {build.runes.length > 0 && (
        <section aria-label="รูน" className="space-y-4">
          {RUNE_COLOR_VIEW.map((c) => runeRow(c.label, c.hex, build.runes.filter((r) => r.color === c.k)))}
          {runeRow("รูน", null, otherRunes)}
        </section>
      )}

      {build.spell && (
        <section aria-label="สกิลชาเลนเจอร์">
          <p className={heading}>สกิลชาเลนเจอร์</p>
          <Link to={catalogPath("spells", build.spell.slug)} className="inline-flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-2 pr-4 transition hover:border-accent/40">
            <Thumb src={build.spell.icon} label={build.spell.nameTh} round className="h-12 w-12" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{build.spell.nameTh}</span>
              <span className="block text-xs text-text-faint">
                {build.spell.name}{build.spell.cooldownSeconds != null ? ` · CD ${build.spell.cooldownSeconds}s` : ""}
              </span>
            </span>
          </Link>
        </section>
      )}

      {build.enchantments.length > 0 && (
        <section aria-label="พลังแฝง" className="space-y-3">
          {([["พลังแฝง — หลัก", primary], ["พลังแฝง — รอง", secondary]] as const).map(([label, list]) =>
            list.length === 0 ? null : (
              <div key={label}>
                <p className={heading}>{label}</p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {list.map((e) => (
                    <Link
                      key={e.slug}
                      to={catalogPath("enchantments", e.slug)}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-bg-surface text-center transition hover:border-accent/40"
                    >
                      <Thumb src={e.icon} label={e.nameTh} className="h-10 w-10" />
                      <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{e.nameTh}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}
        </section>
      )}
    </div>
  );
}
