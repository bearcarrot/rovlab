import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { listMyMatches } from "@/services/matches";
import { MIN_GAMES_FOR_INSIGHTS, buildInsights, summarize } from "@/features/matches/stats";
import { cn } from "@/lib/utils";
import type { MatchRecord } from "@/types/match";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

// การ์ดสรุปแมตช์ของผู้ใช้บนหน้า Home — แสดงเฉพาะคนที่ล็อกอิน (Guest ไม่เห็นอะไร)
// วางไว้ล่างสุดของหน้า เพื่อไม่ทำให้เนื้อหาด้านบนขยับ (CLS) และไม่กระทบ LCP
// ข้อมูลคำนวณจากแมตช์ที่ผู้ใช้บันทึกเองเท่านั้น (ไม่มี mock)
export function MyMatchesCard() {
  const { user } = useAuth();
  const q = useAsync(() => (user ? listMyMatches(20) : Promise.resolve([] as MatchRecord[])), [user?.id]);

  if (!user || q.status === "error") return null;
  if (q.status === "loading") {
    return <div aria-busy="true" className="h-40 rounded-card border border-border bg-bg-surface" />;
  }

  const matches = q.data;
  const s = summarize(matches);
  const top = buildInsights(matches)[0];

  return (
    <section aria-labelledby="my-matches-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-semibold tracking-widest text-accent">YOU</span>
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-accent to-transparent" />
          </div>
          <h2 id="my-matches-heading" className="mt-1 font-display text-xl font-semibold leading-tight sm:text-2xl">
            วิเคราะห์เกมของฉัน
          </h2>
        </div>
        <Link
          to="/matches"
          className={cn("inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline", FOCUS)}
        >
          ดูทั้งหมด <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {!s ? (
        <Link
          to="/matches"
          className={cn(
            "group flex min-h-11 items-center gap-4 rounded-card border border-dashed border-border bg-bg-surface p-4 transition-colors hover:border-accent/50",
            FOCUS
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/30">
            <ClipboardList className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold leading-tight">อัปโหลดสกรีนชอตแมตช์แรกของคุณ</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              ระบบอ่านตัวเลขจากหน้าสรุปผลให้ แล้วสรุปสถิติและข้อสังเกตจากแมตช์ที่คุณบันทึก
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" />
        </Link>
      ) : (
        <div className="space-y-4 rounded-card border border-border bg-bg-surface p-4">
          <p className="text-xs text-text-muted">จาก {s.games} แมตช์ล่าสุดที่คุณบันทึก</p>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <StatTile
              value={`${Math.round(s.winRate * 100)}%`}
              label="อัตราชนะ"
              valueClass={s.winRate >= 0.5 ? "text-win" : "text-loss"}
              bar={Math.round(s.winRate * 100)}
              barClass={s.winRate >= 0.5 ? "bg-win" : "bg-loss"}
            />
            <StatTile value={s.kda.toFixed(2)} label="KDA" />
            <StatTile value={s.avgRating.toFixed(1)} label="คะแนนเฉลี่ย" />
          </div>
          {top ? (
            <p
              className={cn(
                "rounded-lg border-l-2 p-3 text-xs leading-relaxed",
                top.tone === "warn" ? "border-accent bg-accent/10 text-text" : "border-win bg-win/10 text-text"
              )}
            >
              <span className={cn("font-medium", top.tone === "warn" ? "text-accent" : "text-win")}>{top.title}</span>
              {" — "}
              {top.detail}
            </p>
          ) : matches.length < MIN_GAMES_FOR_INSIGHTS ? (
            <p className="text-xs text-text-muted">
              บันทึกอีก {MIN_GAMES_FOR_INSIGHTS - matches.length} แมตช์เพื่อดูข้อสังเกตจากการเล่นของคุณ
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StatTile({
  value,
  label,
  valueClass,
  bar,
  barClass,
}: {
  value: string;
  label: string;
  valueClass?: string;
  /** 0–100: หลอดสัดส่วนใต้ตัวเลข (ใช้กับอัตราชนะ) */
  bar?: number;
  barClass?: string;
}) {
  return (
    <div className="rounded-xl bg-bg-raised px-2 py-3">
      <p className={cn("font-display text-2xl font-semibold tabular-nums leading-none", valueClass)}>{value}</p>
      <p className="mt-1.5 text-[11px] text-text-muted">{label}</p>
      {bar !== undefined && (
        <div className="mx-auto mt-2 h-1 w-3/4 overflow-hidden rounded-full bg-bg">
          <div className={cn("h-full rounded-full", barClass)} style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
    </div>
  );
}
