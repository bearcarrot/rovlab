import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { HeroIcon } from "@/components/HeroIcon";
import { ShareImageButton } from "@/components/ShareImageButton";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { Badge } from "@/components/ui/badge";
import { RoleFilterRow, TIER_OPTIONS } from "@/features/heroes/HeroFilters";
import { heroRoles } from "@/lib/heroPositions";
import { renderTierListImage } from "@/lib/shareImage/tierListImage";
import { cn } from "@/lib/utils";
import type { HeroRole, HeroSummary, Tier } from "@/types/hero";

const STORAGE_KEY = "rovlab:my-tier-list:v1";
const DEFAULT_TITLE = "Tier List ของฉัน";
const TITLE_MAX = 40;

interface Saved {
  title: string;
  tiers: Record<string, Tier>; // hero slug -> tier
}

// Personal tier lists live in this browser only (localStorage). No account or DB needed.
function loadSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { title: DEFAULT_TITLE, tiers: {} };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const tiers: Record<string, Tier> = {};
    for (const [slug, t] of Object.entries(parsed.tiers ?? {})) {
      if (TIER_OPTIONS.includes(t as Tier)) tiers[slug] = t as Tier;
    }
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.slice(0, TITLE_MAX) : DEFAULT_TITLE;
    return { title, tiers };
  } catch {
    return { title: DEFAULT_TITLE, tiers: {} };
  }
}

export function MyTierList() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<HeroRole | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage unavailable: the list still works until the page is closed
    }
  }, [saved]);

  const heroes = useMemo(() => (heroesQ.status === "success" ? heroesQ.data : []), [heroesQ]);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);

  const rows = useMemo(() => {
    const map = new Map<Tier, HeroSummary[]>();
    for (const t of TIER_OPTIONS) map.set(t, []);
    for (const h of heroes) {
      const t = saved.tiers[h.slug];
      if (t) map.get(t)?.push(h);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return map;
  }, [heroes, saved.tiers]);

  const assignedCount = useMemo(() => [...rows.values()].reduce((n, l) => n + l.length, 0), [rows]);

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes
      .filter((h) => !saved.tiers[h.slug])
      .filter((h) => role === null || heroRoles(h).includes(role))
      .filter((h) => q === "" || h.nameTh.includes(query.trim()) || h.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [heroes, saved.tiers, role, query]);

  const selected = selectedSlug ? bySlug.get(selectedSlug) ?? null : null;

  function place(tier: Tier | null) {
    if (!selected) return;
    setSaved((prev) => {
      const tiers = { ...prev.tiers };
      if (tier) tiers[selected.slug] = tier;
      else delete tiers[selected.slug];
      return { ...prev, tiers };
    });
    setSelectedSlug(null);
  }

  function clearAll() {
    if (assignedCount === 0) return;
    if (!window.confirm("ล้าง Tier List ของคุณทั้งหมด?")) return;
    setSaved((prev) => ({ ...prev, tiers: {} }));
    setSelectedSlug(null);
  }

  function toggleSelect(slug: string) {
    setSelectedSlug((cur) => (cur === slug ? null : slug));
  }

  const title = saved.title.trim() || DEFAULT_TITLE;

  return (
    <div className={cn("space-y-4", selected && "pb-28")}>
      <div>
        <h1 className="font-display text-xl font-semibold">สร้าง Tier List ของฉัน</h1>
        <p className="mt-1 text-xs text-text-faint">
          แตะฮีโร่ แล้วเลือก Tier ที่แถบด้านล่าง · แตะฮีโร่ที่จัดแล้วเพื่อย้ายหรือเอาออก · บันทึกอัตโนมัติในเบราว์เซอร์นี้
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={saved.title}
          maxLength={TITLE_MAX}
          onChange={(e) => setSaved((prev) => ({ ...prev, title: e.target.value }))}
          aria-label="ชื่อ Tier List"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
        <ShareImageButton
          title={title}
          filenameBase="rovlab-my-tier-list"
          disabled={assignedCount === 0}
          render={(format) =>
            renderTierListImage(
              {
                title,
                subtitle: `จัดแล้ว ${assignedCount} ตัว · สร้างด้วย RovLab`,
                footnote: "Tier List ส่วนตัว เป็นความเห็นของผู้สร้าง ไม่ใช่การจัดอันดับทางการ",
                rows: TIER_OPTIONS.map((t) => ({
                  tier: t,
                  heroes: (rows.get(t) ?? []).map((h) => ({ name: h.name, nameTh: h.nameTh, icon: h.icon })),
                })),
              },
              format
            )
          }
        />
        <button
          type="button"
          onClick={clearAll}
          disabled={assignedCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-loss hover:bg-bg-raised disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> ล้างทั้งหมด
        </button>
      </div>

      {heroesQ.status === "loading" && <Skeleton className="h-48" />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}

      {heroesQ.status === "success" && (
        <>
          <p className="text-xs text-text-muted">จัดแล้ว {assignedCount}/{heroes.length} ตัว</p>

          <div className="space-y-2">
            {TIER_OPTIONS.map((t) => {
              const list = rows.get(t) ?? [];
              return (
                <div key={t} className="flex items-stretch gap-2">
                  <div className="flex w-12 shrink-0 items-center justify-center rounded-lg bg-bg-surface">
                    <Badge tier={t} className="px-2.5 py-1 text-sm">{t}</Badge>
                  </div>
                  <div className="flex min-h-14 flex-1 flex-wrap content-start gap-1.5 rounded-lg border border-border bg-bg-surface p-1.5">
                    {list.length === 0 && <span className="px-1 py-3 text-xs text-text-faint">ยังไม่มีฮีโร่ใน Tier นี้</span>}
                    {list.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => toggleSelect(h.slug)}
                        aria-label={h.nameTh}
                        title={h.nameTh}
                        className={cn(
                          "h-12 w-12 overflow-hidden rounded-lg",
                          selectedSlug === h.slug ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/40"
                        )}
                      >
                        <HeroIcon icon={h.icon} name={h.name} className="h-full w-full" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">ยังไม่ได้จัด ({pool.length})</h2>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาฮีโร่ (ไทย/อังกฤษ)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
              />
            </div>
            <RoleFilterRow value={role} onChange={setRole} />
            {pool.length === 0 ? (
              <p className="text-sm text-text-faint">
                {assignedCount === heroes.length ? "จัดครบทุกตัวแล้ว" : "ไม่พบฮีโร่ที่ตรงกับตัวกรอง"}
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {pool.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleSelect(h.slug)}
                    aria-label={h.nameTh}
                    title={h.nameTh}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg",
                      selectedSlug === h.slug ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/40"
                    )}
                  >
                    <HeroIcon icon={h.icon} name={h.name} className="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <HeroIcon icon={selected.icon} name={selected.name} className="h-full w-full" />
              </div>
              <span className="max-w-32 truncate text-sm font-medium">{selected.nameTh}</span>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
              {TIER_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => place(t)}
                  aria-label={`จัดให้อยู่ Tier ${t}`}
                  aria-pressed={saved.tiers[selected.slug] === t}
                  className={cn("rounded-lg", saved.tiers[selected.slug] === t && "ring-2 ring-text")}
                >
                  <Badge tier={t} className="px-3.5 py-2 text-sm">{t}</Badge>
                </button>
              ))}
              {saved.tiers[selected.slug] && (
                <button type="button" onClick={() => place(null)} className="rounded-lg border border-border px-2.5 py-2 text-xs text-text-muted hover:text-text">
                  เอาออก
                </button>
              )}
              <button type="button" onClick={() => setSelectedSlug(null)} aria-label="ยกเลิกการเลือก" className="rounded-lg p-2 text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
