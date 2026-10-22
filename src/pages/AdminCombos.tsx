import { useMemo, useState } from "react";
import { Handshake, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { comboError, deleteCombo, listAllCombos, setComboFlags, type Combo } from "@/services/combos";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Chip } from "@/features/heroes/HeroFilters";
import { ComboCard } from "@/features/combo/ComboCard";
import { ComboEditor } from "@/features/combo/ComboEditor";
import { Switch } from "@/features/community/Switch";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { heroMatchesQuery } from "@/lib/heroSearch";

type Filter = "all" | "featured" | "community" | "private" | "hidden";
const FILTERS: [Filter, string][] = [
  ["all", "ทั้งหมด"],
  ["featured", "แนะนำ"],
  ["community", "Community"],
  ["private", "ส่วนตัว"],
  ["hidden", "ซ่อนอยู่"],
];
const MATCH: Record<Filter, (c: Combo) => boolean> = {
  all: () => true,
  featured: (c) => c.isFeatured,
  community: (c) => c.isPublic && !c.isFeatured,
  private: (c) => !c.isPublic,
  hidden: (c) => c.hidden,
};

const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text disabled:opacity-60";

// แท็บ Combo ในหน้าแอดมิน: เพิ่ม Combo แนะนำ (ฮีโร่ 2–5 ตัว) · ตั้ง Combo ของ Community เป็นแนะนำ · ซ่อนของที่ไม่เหมาะสม · แก้/ลบ
// สิทธิ์บังคับที่ RLS + trigger (เฉพาะแอดมินเปลี่ยน is_featured / hidden ได้)
export function AdminCombos() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const { user } = useAuth();
  const toast = useToast();
  const q = useAsync(() => listAllCombos(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ combo: Combo | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  const shown = useMemo(() => {
    if (q.status !== "success") return [];
    return q.data.filter(
      (c) =>
        MATCH[filter](c) &&
        (query.trim() === "" ||
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.heroIds.some((id) => { const h = heroById.get(id); return !!h && heroMatchesQuery(h, query); }))
    );
  }, [q, filter, query, heroById]);

  async function flags(c: Combo, patch: { is_featured?: boolean; hidden?: boolean }, okMsg: string) {
    setBusyId(c.id);
    try {
      await setComboFlags(c.id, patch);
      toast.success(okMsg);
      q.refetch();
    } catch (e) {
      toast.error(comboError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Combo) {
    const ok = await confirmDialog({ title: "ลบ Combo นี้?", message: `“${c.name}” จะถูกลบถาวร (รวมถึงคะแนนถูกใจ/ไม่ถูกใจ)`, confirmLabel: "ลบ", danger: true });
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

  return (
    <div className="space-y-4 pb-4">
      <ConfirmHost />
      <div>
        <h2 className="font-display text-lg font-semibold">Combo</h2>
        <p className="mt-1 text-sm text-text-muted">“แนะนำ” = ขึ้นแท็บ Combo แนะนำ (เลือกได้เฉพาะที่ผู้สร้างเผยแพร่แล้ว) · “ซ่อน” = ไม่แสดงในเว็บให้ใครนอกจากเจ้าของ</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ Combo หรือฮีโร่..."
            aria-label="ค้นหา Combo"
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
          />
        </div>
        <button
          type="button"
          disabled={!user || heroesQ.status !== "success"}
          onClick={() => setEditor({ combo: null })}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:brightness-110 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          เพิ่ม Combo แนะนำ
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" role="group" aria-label="กรอง Combo">
        {FILTERS.map(([f, label]) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)} label={label} />
        ))}
      </div>

      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {(q.status === "loading" || heroesQ.status === "loading") && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      )}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

      {q.status === "success" && heroesQ.status === "success" && (
        <>
          <p className="text-xs text-text-muted">{shown.length === q.data.length ? q.data.length : `${shown.length}/${q.data.length}`} รายการ</p>
          {q.data.length === 0 && <EmptyState icon={Handshake} title="ยังไม่มี Combo" description="กด “เพิ่ม Combo แนะนำ” เพื่อเริ่ม" />}
          {q.data.length > 0 && shown.length === 0 && <p className="text-sm text-text-faint">ไม่พบ Combo ที่ตรงกับตัวกรองหรือคำค้นหา</p>}
          {shown.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 md:items-start">
              {shown.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <ComboCard combo={c} heroes={heroById} featured={c.isFeatured} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-bg-surface px-3 py-2">
                    <Switch
                      checked={c.isFeatured}
                      disabled={busyId === c.id || (!c.isFeatured && !c.isPublic)}
                      onChange={(v) => void flags(c, { is_featured: v }, v ? "ตั้งเป็น Combo แนะนำแล้ว" : "เอาออกจาก Combo แนะนำแล้ว")}
                      label="แนะนำ"
                    />
                    <Switch
                      checked={c.hidden}
                      disabled={busyId === c.id}
                      onChange={(v) => void flags(c, { hidden: v }, v ? "ซ่อนแล้ว" : "เลิกซ่อนแล้ว")}
                      label="ซ่อน"
                    />
                    <div className="ml-auto flex gap-1.5">
                      <button type="button" aria-label="แก้ไข Combo" disabled={busyId === c.id} onClick={() => setEditor({ combo: c })} className={ICON_BTN}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="ลบ Combo" disabled={busyId === c.id} onClick={() => void remove(c)} className={`${ICON_BTN} hover:text-loss`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editor && user && heroesQ.status === "success" && (
        <ComboEditor
          admin
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
