import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompareArrows, LogIn, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import {
  counterPickError,
  createCounterPicks,
  deleteCounterPick,
  listMyCounterPicks,
  REASON_MAX,
  updateCounterPick,
  type UserCounterPick,
} from "@/services/userCounterPicks";
import type { CounterStrength } from "@/services/draft";
import type { HeroSummary } from "@/types/hero";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { HeroIcon } from "@/components/HeroIcon";
import { Modal } from "@/features/community/Modal";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { MATCHUP_STARS, StarRating } from "@/features/heroes/MatchupStars";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";

const FIELD = "w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm";
const CTA = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:brightness-110";
const STRENGTHS: CounterStrength[] = ["best", "good", "situational"];
const STRENGTH_ORDER: Record<CounterStrength, number> = { best: 0, good: 1, situational: 2 };
const STRENGTH_LABEL: Record<CounterStrength, string> = { best: "ชนะทางได้ดีที่สุด", good: "ชนะทางได้ดี", situational: "ใช้ได้เฉพาะสถานการณ์" };

const heroFallback = (h: HeroSummary) => h.name.slice(0, 2).toUpperCase();

// Grid picker used for both the enemy (single) and the counter heroes (multi). `taken` heroes are shown but cannot be chosen.
function HeroPicker({
  heroes,
  scope,
  selected,
  onToggle,
  disabledIds,
}: {
  heroes: HeroSummary[];
  scope: string;
  selected: string[];
  onToggle: (id: string) => void;
  disabledIds?: string[];
}) {
  const filters = useHeroFilters(scope);
  const [query, setQuery] = useState("");
  const list = useMemo(() => heroes.filter((h) => filters.match(h) && heroMatchesQuery(h, query)), [heroes, filters.match, query]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาฮีโร่..."
          aria-label="ค้นหาฮีโร่"
          className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
        />
      </div>
      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
        ) : (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            {list.map((h) => {
              const on = selected.includes(h.id);
              const off = !!disabledIds?.includes(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={on}
                  disabled={off}
                  onClick={() => onToggle(h.id)}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1 rounded-lg border p-1 text-center disabled:opacity-40",
                    on ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
                  )}
                >
                  <HeroIcon icon={h.icon} name={h.nameTh} fallback={heroFallback(h)} className="aspect-square h-auto w-full rounded-md" />
                  <span className="w-full truncate text-[10px] leading-tight">{h.nameTh}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedHeroes({ ids, byId, onRemove }: { ids: string[]; byId: Map<string, HeroSummary>; onRemove?: (id: string) => void }) {
  if (ids.length === 0) return <p className="text-xs text-text-faint">ยังไม่ได้เลือก</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const h = byId.get(id);
        if (!h) return null;
        return (
          <span key={id} className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/10 py-1 pl-1 pr-2 text-xs">
            <HeroIcon icon={h.icon} name={h.nameTh} fallback={heroFallback(h)} className="h-7 w-7 rounded-md" />
            {h.nameTh}
            {onRemove && (
              <button type="button" aria-label={`เอา ${h.nameTh} ออก`} onClick={() => onRemove(id)}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

// Create (one enemy + one or more counter heroes) or edit (strength + reason only; the hero pair is fixed).
function CounterEditor({
  initial,
  heroes,
  userId,
  onClose,
  onSaved,
}: {
  initial: UserCounterPick | null;
  heroes: HeroSummary[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const [enemyId, setEnemyId] = useState<string | null>(initial?.enemyHeroId ?? null);
  const [counterIds, setCounterIds] = useState<string[]>(initial ? [initial.counterHeroId] : []);
  const [strength, setStrength] = useState<CounterStrength>(initial?.strength ?? "good");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!initial) {
      if (!enemyId) return setError("เลือกฮีโร่ศัตรูก่อน");
      if (counterIds.length === 0) return setError("เลือกฮีโร่ที่สู้ได้อย่างน้อย 1 ตัว");
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateCounterPick(initial.id, { strength, reason });
      else await createCounterPicks({ ownerId: userId, enemyHeroId: enemyId!, counterHeroIds: counterIds, strength, reason });
      toast.success(initial ? "บันทึกแล้ว" : "เพิ่ม Counter แล้ว");
      onSaved();
    } catch (e) {
      console.error("user_counter_picks save failed", e); // raw error kept for debugging; the user sees the Thai message
      setError(counterPickError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "แก้ไข Counter" : "เพิ่ม Counter"} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-faint">ฮีโร่ศัตรู</p>
          {initial ? (
            <SelectedHeroes ids={[initial.enemyHeroId]} byId={byId} />
          ) : (
            <>
              <SelectedHeroes ids={enemyId ? [enemyId] : []} byId={byId} onRemove={() => setEnemyId(null)} />
              <HeroPicker
                heroes={heroes}
                scope="my-counter-enemy"
                selected={enemyId ? [enemyId] : []}
                onToggle={(id) => {
                  setEnemyId(id);
                  setCounterIds((c) => c.filter((x) => x !== id));
                }}
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-faint">ฮีโร่ที่สู้ได้{initial ? "" : " (เลือกได้หลายตัว)"}</p>
          {initial ? (
            <SelectedHeroes ids={[initial.counterHeroId]} byId={byId} />
          ) : (
            <>
              <SelectedHeroes ids={counterIds} byId={byId} onRemove={(id) => setCounterIds((c) => c.filter((x) => x !== id))} />
              <HeroPicker
                heroes={heroes}
                scope="my-counter-pick"
                selected={counterIds}
                disabledIds={enemyId ? [enemyId] : []}
                onToggle={(id) => setCounterIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-faint">ระดับ</p>
          <div className="flex flex-wrap gap-2">
            {STRENGTHS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={strength === s}
                onClick={() => setStrength(s)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  strength === s ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
                )}
              >
                <StarRating stars={MATCHUP_STARS[s].stars} label={MATCHUP_STARS[s].label} />
                {STRENGTH_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-medium text-text-faint">
            <span>เหตุผล (ไม่บังคับ)</span>
            <span>{reason.length}/{REASON_MAX}</span>
          </span>
          <textarea
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ทำไมตัวนี้ชนะทาง เช่น สกิลไหนล็อกหรือหนีสกิลของศัตรูได้"
            className={cn(FIELD, "resize-none")}
          />
        </label>

        {error && <p role="alert" className="text-sm text-loss">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 text-sm text-text-muted hover:text-text">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="h-11 rounded-lg bg-accent px-6 text-sm font-semibold text-accent-fg hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// "Counter ของฉัน" tab of the Counter Pick page: list grouped by enemy hero, create / edit / delete.
export function MyCounterPicks() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;
  const heroesQ = useAsync(() => getHeroes(), []);
  // tagged with the user it was loaded for so a previous account's rows are never shown after switching accounts
  const q = useAsync(() => (userId ? listMyCounterPicks().then((rows) => ({ userId, rows })) : Promise.resolve(null)), [userId]);
  const [editor, setEditor] = useState<{ pick: UserCounterPick | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const rows = q.status === "success" && q.data && q.data.userId === userId ? q.data.rows : null;

  const groups = useMemo(() => {
    const m = new Map<string, UserCounterPick[]>();
    for (const p of rows ?? []) m.set(p.enemyHeroId, [...(m.get(p.enemyHeroId) ?? []), p]);
    for (const l of m.values()) l.sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength]);
    return [...m.entries()];
  }, [rows]);

  async function remove(p: UserCounterPick) {
    const enemy = byId.get(p.enemyHeroId)?.nameTh ?? "";
    const counter = byId.get(p.counterHeroId)?.nameTh ?? "";
    const ok = await confirmDialog({ title: "ลบ Counter นี้?", message: `${counter} สู้ ${enemy} จะถูกลบถาวร`, confirmLabel: "ลบ", danger: true });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await deleteCounterPick(p.id);
      toast.success("ลบแล้ว");
      q.refetch();
    } catch (e) {
      console.error("user_counter_picks delete failed", e);
      toast.error(counterPickError(e, "ลบไม่สำเร็จ ลองใหม่อีกครั้ง"));
    } finally {
      setBusyId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="space-y-3">
        <EmptyState icon={LogIn} title="เข้าสู่ระบบเพื่อใช้ข้อมูลของฉัน" description="เข้าสู่ระบบเพื่อบันทึก Counter ของคุณเอง ไม่มีใครอื่นเห็น" />
        <Link to={withNext("/login", "/counter-pick?tab=mine")} className="block text-center text-sm text-accent">เข้าสู่ระบบ →</Link>
      </div>
    );
  }

  const loading = authLoading || heroesQ.status === "loading" || q.status === "loading" || (q.status === "success" && rows === null);

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-muted">Counter ที่คุณบันทึกไว้เอง เห็นเฉพาะคุณ และใช้ใน Draft Assistant ได้เมื่อเลือก “ข้อมูล Counter: ของฉัน”</p>
        <button type="button" disabled={heroesQ.status !== "success" || !user} onClick={() => setEditor({ pick: null })} className={`${CTA} disabled:opacity-60`}>
          <Plus className="h-4 w-4" />
          เพิ่ม Counter
        </button>
      </div>

      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {loading && q.status !== "error" && heroesQ.status !== "error" && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      )}

      {rows && heroesQ.status === "success" && rows.length === 0 && (
        <EmptyState icon={GitCompareArrows} title="คุณยังไม่มีข้อมูล Counter ของตัวเอง" description="กด “เพิ่ม Counter” เพื่อเลือกฮีโร่ศัตรูและฮีโร่ที่สู้ได้" />
      )}

      {rows && heroesQ.status === "success" && groups.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(([enemyId, picks]) => {
            const enemy = byId.get(enemyId);
            return (
              <div key={enemyId} className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
                <div className="flex items-center gap-2">
                  {enemy && <HeroIcon icon={enemy.icon} name={enemy.nameTh} fallback={heroFallback(enemy)} className="h-10 w-10 rounded-md border border-border" />}
                  <div className="min-w-0">
                    <p className="text-[11px] text-accent">ฮีโร่ศัตรู</p>
                    <p className="truncate text-sm">{enemy?.nameTh ?? "ไม่พบฮีโร่"}</p>
                  </div>
                </div>
                {picks.map((p) => {
                  const h = byId.get(p.counterHeroId);
                  return (
                    <div key={p.id} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-2.5">
                      {h && <HeroIcon icon={h.icon} name={h.nameTh} fallback={heroFallback(h)} className="h-11 w-11 rounded-md" />}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">{h?.nameTh ?? "ไม่พบฮีโร่"}</span>
                          <StarRating stars={MATCHUP_STARS[p.strength].stars} label={MATCHUP_STARS[p.strength].label} />
                        </div>
                        {p.reason && <p className="text-xs text-text-muted">{p.reason}</p>}
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <button
                          type="button"
                          aria-label="แก้ไข Counter"
                          disabled={busyId === p.id}
                          onClick={() => setEditor({ pick: p })}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text disabled:opacity-60"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="ลบ"
                          disabled={busyId === p.id}
                          onClick={() => void remove(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-loss disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {editor && user && heroesQ.status === "success" && (
        <CounterEditor
          initial={editor.pick}
          heroes={heroes}
          userId={user.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}
