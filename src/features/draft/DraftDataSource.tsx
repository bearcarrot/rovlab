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

// Loads the signed-in user's own rows only while the source is "mine". The request is tagged with the user id it was made for and
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
  const counters = useMine<UserCounterPick>(counterSource === "mine", () => listMyCounterPicks());
  const combos = useMine<Combo>(comboSource === "mine", (id) => listMyCombos(id));
  return { counterSource, comboSource, setCounterSource: setCounterRaw, setComboSource: setComboRaw, counters, combos };
}

function RadioGroup({ label, value, onChange }: { label: string; value: DraftSource; onChange: (v: DraftSource) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm text-text-muted">{label}</legend>
      <div className="flex gap-2">
        {SOURCE_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-accent" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Placed under the Tier List dropdown. Compact: the two groups sit side by side from sm up and stack on phones.
export function DraftDataSourcePicker({ src }: { src: DraftDataSources }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <RadioGroup label="ข้อมูล Counter" value={src.counterSource} onChange={src.setCounterSource} />
      <RadioGroup label="ข้อมูล Combo" value={src.comboSource} onChange={src.setComboSource} />
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
