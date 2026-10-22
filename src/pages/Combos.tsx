import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Handshake, LogIn, Plus, Search } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { comboError, deleteCombo, listCommunityCombos, listFeaturedCombos, listMyCombos, setComboPublic, type Combo } from "@/services/combos";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Chip } from "@/features/heroes/HeroFilters";
import { ComboCard } from "@/features/combo/ComboCard";
import { ComboEditor } from "@/features/combo/ComboEditor";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { heroMatchesQuery } from "@/lib/heroSearch";

type Tab = "recommended" | "mine" | "community";
const TABS: [Tab, string][] = [
  ["recommended", "Combo แนะนำ"],
  ["mine", "Combo ของฉัน"],
  ["community", "Community"],
];

const CTA = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:brightness-110";

export function Combos() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some(([t]) => t === params.get("tab")) ? (params.get("tab") as Tab) : "recommended";
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ combo: Combo | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useAsync(
    () =>
      tab === "recommended"
        ? listFeaturedCombos()
        : tab === "community"
          ? listCommunityCombos()
          : user
            ? listMyCombos(user.id)
            : Promise.resolve([] as Combo[]),
    [tab, user?.id]
  );

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  // ค้นด้วยชื่อฮีโร่: เจอทุก Combo ที่มีฮีโร่ตัวนั้นอยู่ด้วย
  const shown = useMemo(() => {
    if (q.status !== "success") return [];
    if (query.trim() === "") return q.data;
    return q.data.filter((c) => c.heroIds.some((id) => { const h = heroById.get(id); return !!h && heroMatchesQuery(h, query); }));
  }, [q, query, heroById]);

  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("tab", t);
        return n;
      },
      { replace: true }
    );

  async function togglePublic(c: Combo, next: boolean) {
    setBusyId(c.id);
    try {
      await setComboPublic(c.id, next);
      toast.success(next ? "เผยแพร่แล้ว" : "ตั้งเป็นส่วนตัวแล้ว");
      q.refetch();
    } catch (e) {
      toast.error(comboError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Combo) {
    const ok = await confirmDialog({ title: "ลบ Combo นี้?", message: `“${c.name}” จะถูกลบถาวร`, confirmLabel: "ลบ", danger: true });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await deleteCombo(c.id);
      toast.success("ลบแล้ว");
      q.refetch();
    } catch (e) {
      toast.error(comboError(e, "ลบไม่สำเร็จ ลองใหม่อีกครั้ง"));
    } finally {
      setBusyId(null);
    }
  }

  const guestOnMine = tab === "mine" && !authLoading && !user;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-4">
      <ConfirmHost />
      <div>
        <h1 className="font-display text-xl font-semibold">Combo</h1>
        <p className="mt-1 text-sm text-text-muted">ฮีโร่ 2–5 ตัวที่เล่นด้วยกันแล้วเสริมกัน พร้อมวิธีต่อสกิล สร้างเองและแบ่งปันให้ Community ได้</p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" role="tablist" aria-label="หมวด Combo">
        {TABS.map(([t, label]) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)} label={label} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาฮีโร่ใน Combo..."
            aria-label="ค้นหาฮีโร่ใน Combo"
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
          />
        </div>
        {user ? (
          <button type="button" disabled={heroesQ.status !== "success"} onClick={() => setEditor({ combo: null })} className={`${CTA} disabled:opacity-60`}>
            <Plus className="h-4 w-4" />
            สร้าง
          </button>
        ) : (
          <Link to="/login" className={CTA}>
            <LogIn className="h-4 w-4" />
            ล็อกอิน
          </Link>
        )}
      </div>

      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}

      {guestOnMine && (
        <div className="space-y-3">
          <EmptyState icon={LogIn} title="ต้องล็อกอินก่อน" description="เข้าสู่ระบบเพื่อสร้างและเก็บ Combo ของคุณ" />
          <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
        </div>
      )}

      {!guestOnMine && (q.status === "loading" || heroesQ.status === "loading" || (tab === "mine" && authLoading)) && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      )}
      {!guestOnMine && q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

      {!guestOnMine && q.status === "success" && heroesQ.status === "success" && (
        <>
          {q.data.length === 0 && (
            <EmptyState
              icon={Handshake}
              title={tab === "mine" ? "ยังไม่มี Combo ของคุณ" : tab === "community" ? "ยังไม่มี Combo จาก Community" : "ยังไม่มี Combo แนะนำ"}
              description={tab === "recommended" ? "ทีมงานกำลังเพิ่ม Combo แนะนำ" : "กด “สร้าง” เพื่อเลือกฮีโร่แล้วเขียนวิธีต่อ Combo"}
            />
          )}
          {q.data.length > 0 && shown.length === 0 && <p className="text-sm text-text-faint">ไม่พบ Combo ของฮีโร่ที่ค้นหา</p>}
          {shown.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {shown.map((c) => (
                <ComboCard
                  key={c.id}
                  combo={c}
                  heroes={heroById}
                  featured={tab === "recommended"}
                  mine={
                    tab === "mine"
                      ? { busy: busyId === c.id, onEdit: () => setEditor({ combo: c }), onDelete: () => void remove(c), onPublic: (v) => void togglePublic(c, v) }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {editor && user && heroesQ.status === "success" && (
        <ComboEditor
          initial={editor.combo}
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
