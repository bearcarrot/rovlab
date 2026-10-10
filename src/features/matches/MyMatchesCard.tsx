import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
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
    return <div aria-busy="true" className="h-28 rounded-card border border-border bg-bg-surface" />;
  }

  const matches = q.data;
  const s = summarize(matches);
  const top = buildInsights(matches)[0];

  return (
    <section aria-labelledby="my-matches-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="my-matches-heading" className="font-display text-base font-semibold">วิเคราะห์เกมของฉัน</h2>
        <Link to="/matches" className={cn("text-xs text-accent", FOCUS)}>
          ดูทั้งหมด →
        </Link>
      </div>

      {!s ? (
        <Link
          to="/matches"
          className={cn(
            "flex min-h-11 items-start gap-3 rounded-lg border border-border bg-bg-surface p-3 hover:border-accent/40",
            FOCUS
          )}
        >
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
          <div>
            <p className="font-display text-sm font-medium leading-tight">อัปโหลดสกรีนชอตแมตช์แรกของคุณ</p>
            <p className="mt-0.5 text-xs text-text-muted">ระบบอ่านตัวเลขจากหน้าสรุปผลให้ แล้วสรุปสถิติและข้อสังเกตจากแมตช์ที่คุณบันทึก</p>
          </div>
        </Link>
      ) : (
        <div className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
          <p className="text-xs text-text-muted">จาก {s.games} แมตช์ล่าสุดที่คุณบันทึก</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-display text-lg font-semibold tabular-nums">{Math.round(s.winRate * 100)}%</p>
              <p className="text-[11px] text-text-muted">อัตราชนะ</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold tabular-nums">{s.kda.toFixed(2)}</p>
              <p className="text-[11px] text-text-muted">KDA</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold tabular-nums">{s.avgRating.toFixed(1)}</p>
              <p className="text-[11px] text-text-muted">คะแนนเฉลี่ย</p>
            </div>
          </div>
          {top ? (
            <p className={cn("rounded-lg p-2.5 text-xs leading-relaxed", top.tone === "warn" ? "bg-accent/10 text-text" : "bg-win/10 text-text")}>
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
