import { useMemo, useState, type ChangeEvent } from "react";
import { AlertTriangle, ClipboardList, Loader2, Upload } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { deleteMatch, listMyMatches, saveMatch, scanScoreboard } from "@/services/matches";
import { fileToScoreboardBase64 } from "@/lib/image";
import { checkDraft, draftToRow, fingerprint, scanToDraft, type ScanDraft } from "@/features/matches/scan";
import { MIN_GAMES_FOR_INSIGHTS, buildInsights, byHero, summarize } from "@/features/matches/stats";
import { ScanReview } from "@/features/matches/ScanReview";
import { MatchCard } from "@/features/matches/MatchCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";
import type { MatchRecord, MeSource } from "@/types/match";

const NO_HEROES: HeroSummary[] = [];
const NO_MATCHES: MatchRecord[] = [];

type Phase =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "review"; draft: ScanDraft; initial: string; meSource: MeSource; remaining: number };

export function Matches() {
  const { user } = useAuth();
  const heroesQ = useAsync(() => getHeroes(), []);
  const matchesQ = useAsync(() => listMyMatches(100), []);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const heroes = heroesQ.status === "success" ? heroesQ.data : NO_HEROES;
  const matches = matchesQ.status === "success" ? matchesQ.data : NO_MATCHES;
  const iconById = useMemo(() => new Map(heroes.map((h) => [h.id, h.icon])), [heroes]);
  const summary = useMemo(() => summarize(matches), [matches]);
  const insights = useMemo(() => buildInsights(matches), [matches]);
  const heroLines = useMemo(() => byHero(matches).slice(0, 5), [matches]);
  const issues = useMemo(() => (phase.kind === "review" ? checkDraft(phase.draft) : []), [phase]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setError(null);
    setNotice(null);
    setPhase({ kind: "scanning" });
    try {
      const base64 = await fileToScoreboardBase64(file);
      const res = await scanScoreboard(base64);
      const draft = scanToDraft(res.scan);
      setPhase({ kind: "review", draft, initial: fingerprint(draft), meSource: res.meSource, remaining: res.remaining });
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านรูปไม่สำเร็จ");
      setPhase({ kind: "idle" });
    }
  }

  async function onSave() {
    if (phase.kind !== "review" || !user) return;
    setSaving(true);
    setError(null);
    try {
      await saveMatch(draftToRow(phase.draft, heroes, user.id, fingerprint(phase.draft) !== phase.initial));
      setPhase({ kind: "idle" });
      setNotice("บันทึกแมตช์แล้ว");
      matchesQ.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกแมตช์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("ลบแมตช์นี้? การลบกู้คืนไม่ได้")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteMatch(id);
      matchesQ.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบแมตช์ไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  const scanning = phase.kind === "scanning";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-semibold">วิเคราะห์เกม</h1>
        <p className="max-w-xl text-sm text-text-muted">
          อัปโหลดสกรีนชอตหน้า &ldquo;ประวัติการเล่น&rdquo; หลังจบแมตช์ ระบบจะอ่านตัวเลขให้ คุณตรวจแล้วบันทึก
          เมื่อสะสมหลายแมตช์จะเห็นสถิติและข้อสังเกตของตัวเอง
        </p>
      </header>

      {/* Upload / review */}
      <Card>
        <CardHeader>
          <CardTitle>{phase.kind === "review" ? "ตรวจผลที่อ่านได้" : "เพิ่มแมตช์จากรูป"}</CardTitle>
          {phase.kind === "review" && (
            <span className="text-xs text-text-faint">เหลือโควต้าอ่านรูปวันนี้ {phase.remaining} รูป</span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {phase.kind === "review" ? (
            <ScanReview
              draft={phase.draft}
              onChange={(draft) => setPhase({ ...phase, draft })}
              heroes={heroes}
              issues={issues}
              meSource={phase.meSource}
              saving={saving}
              onSave={onSave}
              onCancel={() => setPhase({ kind: "idle" })}
            />
          ) : (
            <>
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-bg sm:inline-flex",
                  scanning && "pointer-events-none opacity-60"
                )}
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {scanning ? "กำลังอ่านรูป…" : "เลือกรูปสรุปผลการเล่น"}
                <input type="file" accept="image/*" onChange={onFile} disabled={scanning} className="sr-only" />
              </label>
              <ul className="list-disc space-y-1 pl-5 text-xs text-text-muted">
                <li>ใช้สกรีนชอตแนวนอนที่เห็นผู้เล่นครบ 10 คน (ไม่ต้องครอป ระบบตัดแถบ UID ด้านล่างทิ้งให้ก่อนส่ง)</li>
                <li>
                  รูปจะถูกส่งให้ Google Gemini อ่านตัวเลข ระบบไม่เก็บรูปต้นฉบับ และไม่บันทึกชื่อของผู้เล่นคนอื่น
                  (ดู <a className="underline underline-offset-2" href="/privacy">Privacy Policy</a>)
                </li>
                <li>จำกัดจำนวนรูปต่อวัน เพื่อไม่ให้โควต้าของระบบหมด</li>
                <li>ใส่ &ldquo;ชื่อในเกม&rdquo; ที่หน้าโปรไฟล์ไว้ ระบบจะหาแถวของคุณได้แม่นขึ้น</li>
              </ul>
            </>
          )}
          {error && (
            <p role="alert" className="flex gap-2 rounded-lg border border-loss/30 bg-loss/5 p-3 text-sm text-loss">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
            </p>
          )}
          {notice && !error && <p role="status" className="text-sm text-win">{notice}</p>}
        </CardContent>
      </Card>

      {/* Stats + insights */}
      {matchesQ.status === "loading" && <Skeleton className="h-40" />}
      {matchesQ.status === "error" && <ErrorState message={matchesQ.message} onRetry={matchesQ.refetch} />}
      {matchesQ.status === "success" && matches.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="ยังไม่มีแมตช์ที่บันทึก"
          description="อัปโหลดสกรีนชอตแมตช์แรกของคุณด้านบน"
        />
      )}

      {summary && (
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2 id="summary-heading" className="font-display text-base font-semibold">
            สรุป {summary.games} แมตช์ที่บันทึก
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="อัตราชนะ" value={`${Math.round(summary.winRate * 100)}%`} sub={`${summary.wins} ชนะ / ${summary.games - summary.wins} แพ้`} />
            <Stat label="KDA เฉลี่ย" value={summary.kda.toFixed(2)} sub={`${summary.avgKills.toFixed(1)} / ${summary.avgDeaths.toFixed(1)} / ${summary.avgAssists.toFixed(1)}`} />
            <Stat label="ทองเฉลี่ย" value={Math.round(summary.avgGold).toLocaleString()} />
            <Stat label="คะแนนเฉลี่ย" value={summary.avgRating.toFixed(1)} sub={summary.mvpCount > 0 ? `MVP ${summary.mvpCount} ครั้ง` : undefined} />
          </div>

          {heroLines.length > 0 && (
            <div className="rounded-card border border-border bg-bg-surface p-3">
              <p className="mb-2 text-xs font-medium text-text-muted">ฮีโร่ที่เล่นบ่อย</p>
              <ul className="space-y-1 text-sm">
                {heroLines.map((h) => (
                  <li key={h.heroId ?? h.heroName} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {h.heroId && iconById.get(h.heroId) ? (
                        <img src={iconById.get(h.heroId)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-6 w-6 rounded object-cover" />
                      ) : null}
                      <span className="truncate">{h.heroName}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-muted">
                      {h.games} เกม · ชนะ {Math.round(h.winRate * 100)}% · KDA {h.kda.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {summary && (
        <section aria-labelledby="insights-heading" className="space-y-3">
          <h2 id="insights-heading" className="font-display text-base font-semibold">ข้อสังเกตจากแมตช์ของคุณ</h2>
          {matches.length < MIN_GAMES_FOR_INSIGHTS ? (
            <p className="text-sm text-text-muted">
              บันทึกอีก {MIN_GAMES_FOR_INSIGHTS - matches.length} แมตช์เพื่อดูข้อสังเกต (ข้อมูลน้อยเกินไปจะทำให้สรุปผิด)
            </p>
          ) : insights.length === 0 ? (
            <p className="text-sm text-text-muted">ยังไม่พบจุดที่โดดเด่นเป็นพิเศษจากแมตช์ล่าสุด</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {insights.map((i) => (
                <li
                  key={i.id}
                  className={cn("rounded-card border p-3", i.tone === "warn" ? "border-accent/40 bg-accent/5" : "border-win/30 bg-win/5")}
                >
                  <p className={cn("font-display text-sm font-medium", i.tone === "warn" ? "text-accent" : "text-win")}>{i.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-text-faint">
            * คำนวณจากแมตช์ที่คุณบันทึกเอง เทียบกับเพื่อนร่วมทีมในรูปเดียวกัน ไม่ใช่ข้อมูลทางการของเกม
          </p>
        </section>
      )}

      {matches.length > 0 && (
        <section aria-labelledby="list-heading" className="space-y-3">
          <h2 id="list-heading" className="font-display text-base font-semibold">แมตช์ที่บันทึก</h2>
          <ul className="space-y-2">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                heroIcon={m.myHeroId ? iconById.get(m.myHeroId) : undefined}
                onDelete={onDelete}
                deleting={deletingId === m.id}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-surface p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-text-faint tabular-nums">{sub}</p>}
    </div>
  );
}
