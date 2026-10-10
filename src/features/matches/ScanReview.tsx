import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveHero, type Issue, type ScanDraft } from "@/features/matches/scan";
import type { HeroSummary } from "@/types/hero";
import type { MatchOutcome, MeSource, ScanPlayer, TeamSide } from "@/types/match";

// Review screen: shows what OCR read, lets the user fix any cell, then save. Nothing is saved before the user confirms.

const FIELD =
  "w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Num({
  value,
  onChange,
  label,
  step = 1,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      value={Number.isFinite(value) ? value : ""}
      min={0}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={cn(FIELD, "text-right tabular-nums", className)}
    />
  );
}

const ME_HINT: Record<"name" | "highlight" | "none", string> = {
  name: "ระบุแถวของคุณจากชื่อในเกมในโปรไฟล์ — ตรวจสอบอีกครั้ง",
  highlight: "ระบุแถวของคุณจากแถบที่สว่างกว่า — ตรวจสอบอีกครั้ง",
  none: "ระบบระบุแถวของคุณไม่ได้ กรุณาเลือกเอง",
};

function TeamTable({
  team,
  draft,
  heroes,
  onPlayer,
  onPickMe,
}: {
  team: TeamSide;
  draft: ScanDraft;
  heroes: HeroSummary[];
  onPlayer: (index: number, patch: Partial<ScanPlayer>) => void;
  onPickMe: (index: number) => void;
}) {
  const rows = draft.players.map((p, i) => ({ p, i })).filter(({ p }) => p.team === team);
  const blue = team === "blue";
  return (
    <div className="space-y-1.5">
      <h3 className={cn("font-display text-sm font-medium", blue ? "text-rift" : "text-loss")}>
        {blue ? "ทีมฟ้า (ทีมของคุณ)" : "ทีมแดง"}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-bg-raised text-left text-[11px] text-text-faint">
              <th className="px-2 py-1.5 font-medium">ฉัน</th>
              <th className="px-2 py-1.5 font-medium">ฮีโร่</th>
              <th className="px-2 py-1.5 text-right font-medium">K</th>
              <th className="px-2 py-1.5 text-right font-medium">D</th>
              <th className="px-2 py-1.5 text-right font-medium">A</th>
              <th className="px-2 py-1.5 text-right font-medium">Gold</th>
              <th className="px-2 py-1.5 text-right font-medium">คะแนน</th>
              <th className="px-2 py-1.5 text-center font-medium">MVP</th>
              <th className="px-2 py-1.5 font-medium">ชื่อในรูป</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, i }) => {
              const known = resolveHero(p.hero, heroes);
              return (
                <tr key={i} className={cn("border-t border-border", p.isMe && "bg-accent/10")}>
                  <td className="px-2 py-1.5">
                    <input
                      type="radio"
                      name="scan-me"
                      checked={p.isMe}
                      onChange={() => onPickMe(i)}
                      aria-label={`แถวนี้คือฉัน (${p.hero || `ผู้เล่น ${i + 1}`})`}
                      className="h-4 w-4 accent-[#E8A33D]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      list="rov-hero-names"
                      aria-label="ชื่อฮีโร่"
                      value={p.hero}
                      onChange={(e) => onPlayer(i, { hero: e.target.value })}
                      className={cn(FIELD, "min-w-[8rem]", p.hero.trim() && !known && heroes.length > 0 && "border-loss/60")}
                    />
                    {p.hero.trim() && !known && heroes.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-loss">ไม่พบฮีโร่นี้ในระบบ (ยังบันทึกได้)</p>
                    )}
                  </td>
                  <td className="px-1 py-1.5"><Num label="Kill" value={p.kills} onChange={(v) => onPlayer(i, { kills: v })} className="w-14" /></td>
                  <td className="px-1 py-1.5"><Num label="Death" value={p.deaths} onChange={(v) => onPlayer(i, { deaths: v })} className="w-14" /></td>
                  <td className="px-1 py-1.5"><Num label="Assist" value={p.assists} onChange={(v) => onPlayer(i, { assists: v })} className="w-14" /></td>
                  <td className="px-1 py-1.5"><Num label="Gold" value={p.gold} onChange={(v) => onPlayer(i, { gold: v })} className="w-20" /></td>
                  <td className="px-1 py-1.5"><Num label="คะแนน" step={0.1} value={p.rating} onChange={(v) => onPlayer(i, { rating: v })} className="w-16" /></td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={p.mvp}
                      onChange={(e) => onPlayer(i, { mvp: e.target.checked })}
                      aria-label="ได้ MVP"
                      className="h-4 w-4 accent-[#E8A33D]"
                    />
                  </td>
                  <td className="max-w-[8rem] truncate px-2 py-1.5 text-xs text-text-faint" title={p.playerName}>
                    {p.playerName || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScanReview({
  draft,
  onChange,
  heroes,
  issues,
  meSource,
  saving,
  onSave,
  onCancel,
}: {
  draft: ScanDraft;
  onChange: (d: ScanDraft) => void;
  heroes: HeroSummary[];
  issues: Issue[];
  meSource: MeSource;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const blocking = issues.filter((i) => i.blocking);
  const warnings = issues.filter((i) => !i.blocking);

  const patchPlayer = (index: number, patch: Partial<ScanPlayer>) =>
    onChange({ ...draft, players: draft.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  const pickMe = (index: number) =>
    onChange({ ...draft, players: draft.players.map((p, i) => ({ ...p, isMe: i === index })) });

  return (
    <div className="space-y-4">
      <datalist id="rov-hero-names">
        {heroes.map((h) => (
          <option key={h.id} value={h.name} />
        ))}
      </datalist>

      <p className="text-xs text-text-muted">
        ตรวจตัวเลขเทียบกับรูปของคุณ แก้ช่องที่อ่านผิดได้ แล้วกดบันทึก — ยังไม่มีอะไรถูกบันทึกจนกว่าจะกดปุ่ม
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs text-text-muted">
          ผล
          <select
            value={draft.result}
            onChange={(e) => onChange({ ...draft, result: e.target.value as MatchOutcome | "" })}
            className={FIELD}
          >
            <option value="">เลือก…</option>
            <option value="victory">ชนะ (Victory)</option>
            <option value="defeat">แพ้ (Defeat)</option>
          </select>
        </label>
        <div className="space-y-1 text-xs text-text-muted">
          สกอร์ ฟ้า : แดง
          <div className="flex items-center gap-1.5">
            <Num label="สกอร์ทีมฟ้า" value={draft.scoreBlue} onChange={(v) => onChange({ ...draft, scoreBlue: v })} />
            <span>:</span>
            <Num label="สกอร์ทีมแดง" value={draft.scoreRed} onChange={(v) => onChange({ ...draft, scoreRed: v })} />
          </div>
        </div>
        <label className="space-y-1 text-xs text-text-muted">
          เวลาเกม (นาที:วินาที)
          <input
            value={draft.duration}
            placeholder="13:49"
            onChange={(e) => onChange({ ...draft, duration: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="space-y-1 text-xs text-text-muted sm:col-span-2">
          วันที่/เวลาของแมตช์
          <input
            type="datetime-local"
            value={draft.playedAt}
            onChange={(e) => onChange({ ...draft, playedAt: e.target.value })}
            className={FIELD}
          />
        </label>
      </div>

      <p className={cn("text-xs", meSource ? "text-text-muted" : "text-accent")}>{ME_HINT[meSource ?? "none"]}</p>

      <TeamTable team="blue" draft={draft} heroes={heroes} onPlayer={patchPlayer} onPickMe={pickMe} />
      <TeamTable team="red" draft={draft} heroes={heroes} onPlayer={patchPlayer} onPickMe={pickMe} />

      {issues.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-border bg-bg-raised p-3 text-sm">
          {blocking.map((i) => (
            <li key={i.code} className="flex gap-2 text-loss">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{i.message}</span>
            </li>
          ))}
          {warnings.map((i) => (
            <li key={i.code} className="flex gap-2 text-accent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSave}
          disabled={blocking.length > 0 || saving}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึกแมตช์
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-lg border border-border bg-bg-surface px-5 py-2.5 text-sm font-medium text-text hover:border-accent/40 disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
