import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { listMyCombos, type Combo } from "@/services/combos";
import { listMyCounterPicks, type UserCounterPick } from "@/services/userCounterPicks";
import { parseSource, SOURCE_OPTIONS, type DraftSource } from "./draftSources";

// Two independent persisted choices (sessionStorage, like the Tier List choice). Separate keys: changing one never touches the other,
// and neither touches the draft session (useDraftSession) or the Tier List choice (rovlab:draft:tierList).
const COUNTER_KEY = "rovlab:draft:counterSource";
const COMBO_KEY = "rovlab:draft:comboSource";

// off = source is "recommended" (nothing loaded); guest = signed out; ready = own data loaded (may be empty)
export type MineState = "off" | "auth-loading" | "guest" | "loading" | "error" | "ready";

// One shared empty array so "no data yet" keeps a stable identity (callers memoize on it)
const NONE: never[] = [];

interface Mine<T> {
  state: MineState;
  data: T[];
  retry: () => void;
}

// Loads the signed-in user's own rows only while the source is "mine" or "all". The request is tagged with the user id it was made for and
// ignored unless that is still the current user, so switching accounts or logging out can never show the previous account's rows.
function useMine<T>(selected: boolean, load: (userId: string) => Promise<T[]>): Mine<T> {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const active = selected && userId !== null;
  const q = useAsync(() => (active && userId ? load(userId).then((rows) => ({ userId, rows })) : Promise.resolve(null)), [active, userId]);
  if (!selected) return { state: "off", data: NONE, retry: q.refetch };
  if (authLoading) return { state: "auth-loading", data: NONE, retry: q.refetch };
  if (!userId) return { state: "guest", data: NONE, retry: q.refetch };
  if (q.status === "error") return { state: "error", data: NONE, retry: q.refetch };
  if (q.status !== "success" || q.data === null || q.data.userId !== userId) return { state: "loading", data: NONE, retry: q.refetch };
  return { state: "ready", data: q.data.rows, retry: q.refetch };
}

export interface DraftDataSources {
  counterSource: DraftSource;
  comboSource: DraftSource;
  setCounterSource: (s: DraftSource) => void;
  setComboSource: (s: DraftSource) => void;
  counters: Mine<UserCounterPick>;
  combos: Mine<Combo>;
}

export function useDraftDataSources(): DraftDataSources {
  const [counterRaw, setCounterRaw] = usePersistedState<string>(COUNTER_KEY, "recommended");
  const [comboRaw, setComboRaw] = usePersistedState<string>(COMBO_KEY, "recommended");
  const counterSource = parseSource(counterRaw);
  const comboSource = parseSource(comboRaw);
  // "ทั้งหมด" ต้องใช้ข้อมูลของฉันด้วย จึงโหลดเหมือน "ของฉัน" (เฉพาะตอนล็อกอิน และไม่ยิงซ้ำ: แต่ละชุดโหลดครั้งเดียวต่อบัญชี)
  const counters = useMine<UserCounterPick>(counterSource !== "recommended", () => listMyCounterPicks());
  const combos = useMine<Combo>(comboSource !== "recommended", (id) => listMyCombos(id));
  return { counterSource, comboSource, setCounterSource: setCounterRaw, setComboSource: setComboRaw, counters, combos };
}

function SourceSelect({ label, value, onChange }: { label: string; value: DraftSource; onChange: (v: DraftSource) => void }) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(parseSource(e.target.value))}
        className="min-h-10 rounded-lg border border-border bg-bg px-3 py-2 text-base sm:text-sm"
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Placed under the Tier List dropdown. Compact: the two dropdowns sit side by side from sm up and wrap on phones.
export function DraftDataSourcePicker({ src }: { src: DraftDataSources }) {
  const anyAll = src.counterSource === "all" || src.comboSource === "all";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <SourceSelect label="ข้อมูล Counter" value={src.counterSource} onChange={src.setCounterSource} />
        <SourceSelect label="ข้อมูล Combo" value={src.comboSource} onChange={src.setComboSource} />
      </div>
      {anyAll && (
        <p className="text-xs text-text-faint">
          ทั้งหมด = ข้อมูลแนะนำของระบบรวมกับของคุณ (คู่เดียวกันใช้ของคุณ) · ถ้าไม่ได้ล็อกอินจะใช้เฉพาะข้อมูลของระบบ
        </p>
      )}
    </div>
  );
}

// Shown instead of recommendations when a source is "mine" and cannot give any (never replaced by official data).
// `empty` is the Thai message for a loaded-but-irrelevant/empty dataset, or null when there is nothing to say.
export function MineNotice({
  mine,
  empty,
  manageTo,
  manageLabel,
}: {
  mine: Mine<unknown>;
  empty: string | null;
  manageTo: string;
  manageLabel: string;
}) {
  if (mine.state === "off") return null;
  const box = "rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted";
  if (mine.state === "auth-loading" || mine.state === "loading") return <p className={box}>กำลังโหลดข้อมูลของคุณ...</p>;
  if (mine.state === "guest") {
    return (
      <div className={`${box} flex flex-wrap items-center gap-2`}>
        <span className="min-w-0 flex-1">เข้าสู่ระบบเพื่อใช้ข้อมูลของฉัน</span>
        <Link to={withNext("/login", "/draft")} className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-fg">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }
  if (mine.state === "error") {
    return (
      <div className={`${box} flex flex-wrap items-center gap-2`}>
        <span className="min-w-0 flex-1">โหลดข้อมูลของคุณไม่สำเร็จ</span>
        <button type="button" onClick={mine.retry} className="rounded-lg border border-border px-3 py-1.5 hover:text-text">
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!empty) return null;
  return (
    <div className={`${box} flex flex-wrap items-center gap-2`}>
      <span className="min-w-0 flex-1">{empty}</span>
      <Link to={manageTo} className="text-accent">
        {manageLabel}
      </Link>
    </div>
  );
}
