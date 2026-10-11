import { Link } from "react-router-dom";
import { Thumb } from "@/features/admin/ImageSelect";
import { useAsync } from "@/hooks/useAsync";
import { getCatalogEnchantments } from "@/services/gameCatalog";

// พาหนะแสดงบิลด์แบบอ่านอย่างเดียว จัดวางแบบหน้าจอบิลด์ในเกม: ไอเทม / พลังแฝง / รูน / สกิล
// ใช้ร่วมกันทั้งบิลด์แนะนำ และบิลด์ของผู้ใช้ — ทุกชิ้นกดแล้วไปหน้าคลังข้อมูลของชิ้นนั้น

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

const ROMAN = ["", "I", "II", "III"];
const KNOWN_COLORS: Set<string> = new Set(RUNE_COLOR_VIEW.map((c) => c.k));

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

// โนดพลังแฝง: วงกลม (หลัก = กรอบแดง, รอง = กรอบทอง) หรือเพชร (keystone) พร้อมเลขระดับใต้ไอคอน
function EnchantNode({ e, keystone, secondary }: { e: ViewEnchant; keystone: boolean; secondary: boolean }) {
  const ring = secondary ? "border-accent" : "border-loss";
  const size = secondary ? "h-11 w-11" : keystone ? "h-12 w-12" : "h-14 w-14";
  return (
    <Link to={catalogPath("enchantments", e.slug)} title={e.nameTh} aria-label={e.nameTh} className="flex flex-col items-center gap-1.5 transition hover:brightness-125">
      {keystone ? (
        <span className="flex h-16 w-16 items-center justify-center">
          <span className={`flex ${size} rotate-45 items-center justify-center overflow-hidden rounded-md border-2 ${ring} bg-bg-raised`}>
            <span className="-rotate-45 scale-[1.45]">
              <Thumb src={e.icon} label={e.nameTh} className="h-10 w-10 !rounded-none !border-0" />
            </span>
          </span>
        </span>
      ) : (
        <span className={`flex ${size} items-center justify-center overflow-hidden rounded-[50%] border-2 ${ring} bg-bg-raised`}>
          <Thumb src={e.icon} label={e.nameTh} round className="h-full w-full" />
        </span>
      )}
      <Tier tier={e.tier} />
    </Link>
  );
}

export function ReadOnlyBuild({ build }: { build: ViewBuild }) {
  const catalog = useAsync(() => getCatalogEnchantments(), []);
  const keystones = new Set<string>(catalog.status === "success" ? catalog.data.list.filter((x) => x.category === "keystone").map((x) => x.slug) : []);

  const primary = build.enchantments.filter((e) => e.type === "primary");
  const secondary = build.enchantments.filter((e) => e.type === "secondary");
  const reasons = build.items.filter((i) => i.reason);

  const orderedRunes = [
    ...RUNE_COLOR_VIEW.flatMap((c) => build.runes.filter((r) => r.color === c.k)),
    ...build.runes.filter((r) => !r.color || !KNOWN_COLORS.has(r.color)),
  ];
  const runeTotal = build.runes.reduce((n, r) => n + Math.max(1, r.quantity), 0);
  const hexOf = (c?: string) => RUNE_COLOR_VIEW.find((x) => x.k === c)?.hex ?? "#5C616D";

  return (
    <div className="space-y-3">
      <Panel title="ไอเทม">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {build.items.map((i) => (
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
          <div className="flex flex-wrap items-start gap-y-3">
            {primary.map((e, i) => (
              <div key={e.slug} className="flex items-start">
                {i > 0 && <span className="mt-7 h-0.5 w-5 shrink-0 bg-loss/60 sm:w-8" aria-hidden />}
                <EnchantNode e={e} keystone={keystones.has(e.slug)} secondary={false} />
              </div>
            ))}
            {primary.length > 0 && secondary.length > 0 && <span className="mx-3 h-14 w-px shrink-0 bg-border" aria-hidden />}
            <div className="flex items-start gap-3">
              {secondary.map((e) => (
                <EnchantNode key={e.slug} e={e} keystone={false} secondary />
              ))}
            </div>
          </div>
        </Panel>
      )}

      {build.runes.length > 0 && (
        <Panel title="รูน">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="relative flex h-14 w-12 shrink-0 items-center justify-center text-rift" role="img" aria-label={`รูนรวม ${runeTotal} ช่อง`}>
              <svg viewBox="0 0 48 56" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
                <path d="M24 2 L45 12 V30 C45 42 36 50 24 54 C12 50 3 42 3 30 V12 Z" stroke="currentColor" strokeWidth="3" className="fill-bg-raised" />
              </svg>
              <span className="relative -mt-1 font-display text-lg font-semibold text-accent">{runeTotal}</span>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              {orderedRunes.map((r) => (
                <Link key={r.key} to={catalogPath("runes", r.name)} title={r.name} aria-label={r.name} className="flex flex-col items-center transition hover:brightness-125">
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[50%] border-2 bg-bg-raised" style={{ borderColor: hexOf(r.color) }}>
                    <Thumb src={r.icon} label={r.name} round className="h-full w-full" />
                  </span>
                  <span className="-mt-2 rounded-full border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold leading-none">×{r.quantity}</span>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {build.spell && (
        <Panel title="สกิล">
          <Link to={catalogPath("spells", build.spell.slug)} title={build.spell.nameTh} aria-label={build.spell.nameTh} className="inline-flex items-center gap-3 transition hover:brightness-125">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[50%] border-2 border-border bg-bg-raised">
              <Thumb src={build.spell.icon} label={build.spell.nameTh} round className="h-full w-full" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{build.spell.nameTh}</span>
              {build.spell.cooldownSeconds != null && <span className="block text-xs text-text-faint">CD {build.spell.cooldownSeconds}s</span>}
            </span>
          </Link>
        </Panel>
      )}
    </div>
  );
}
