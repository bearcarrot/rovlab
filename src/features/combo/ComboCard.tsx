import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { ReactionButtons } from "@/features/community/ReactionButtons";
import { Switch } from "@/features/community/Switch";
import { cn } from "@/lib/utils";
import type { Combo } from "@/services/combos";
import type { HeroSummary } from "@/types/hero";
import { useComboReaction } from "./useComboReaction";

const dateTh = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

export interface MineActions {
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPublic: (next: boolean) => void;
}

const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text disabled:opacity-60";

// การ์ด Combo: แถวไอคอนฮีโร่ (2–5 ตัว คั่นด้วย +) เรียงเต็มความกว้างการ์ด จึงพอดีจอมือถือ 360px — ทุกไอคอนกดไปหน้าฮีโร่ได้
// ใช้ร่วมกันทั้ง 3 แท็บ: แนะนำ (featured) / ของฉัน (mine = สวิตช์เผยแพร่ + แก้ไข + ลบ) / Community (ปุ่มถูกใจ-ไม่ถูกใจ)
export function ComboCard({
  combo,
  heroes,
  featured,
  mine,
}: {
  combo: Combo;
  heroes: Map<string, HeroSummary>;
  featured?: boolean;
  mine?: MineActions;
}) {
  const [open, setOpen] = useState(false);
  const r = useComboReaction(combo);
  const live = combo.isPublic && !combo.hidden;
  const long = combo.note.length > 140;
  const meta = [combo.author ? `โดย ${combo.author}` : null, dateTh(live ? combo.publishedAt : combo.updatedAt)].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-bg-surface">
      <div className="bg-gradient-to-b from-accent/10 to-transparent px-3 pb-2 pt-4 sm:px-4">
        <div className="flex items-start gap-1 sm:gap-1.5">
          {combo.heroIds.map((id, i) => {
            const h = heroes.get(id);
            return (
              <Fragment key={id}>
                {i > 0 && <Plus aria-hidden className="mt-5 h-3 w-3 shrink-0 text-accent sm:mt-6 sm:h-4 sm:w-4" />}
                {h ? (
                  <Link to={`/heroes/${h.slug}`} className="group flex min-w-0 flex-1 basis-0 flex-col items-center gap-1">
                    <HeroIcon
                      icon={h.icon}
                      name={h.nameTh}
                      fallback={h.name.slice(0, 2).toUpperCase()}
                      className="aspect-square h-auto w-full max-w-16 rounded-xl border border-border shadow-sm transition group-hover:border-accent"
                    />
                    <span className="w-full truncate text-center text-[11px] leading-tight text-text-muted group-hover:text-text sm:text-xs">{h.nameTh}</span>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1">
                    <HeroIcon name="?" className="aspect-square h-auto w-full max-w-16 rounded-xl border border-border" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {featured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
              <Sparkles className="h-3 w-3" />
              แนะนำ
            </span>
          )}
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">{combo.heroIds.length} ฮีโร่</span>
          {mine && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px]",
                combo.hidden ? "border-loss/40 text-loss" : combo.isPublic ? "border-win/40 text-win" : "border-border text-text-faint"
              )}
            >
              {combo.hidden ? "ถูกซ่อน" : combo.isPublic ? "เผยแพร่แล้ว" : "ส่วนตัว"}
            </span>
          )}
        </div>

        <h3 className="break-words font-display text-base font-semibold leading-snug">{combo.name}</h3>

        {combo.note && (
          <div>
            <p className={cn("whitespace-pre-line break-words text-sm leading-relaxed text-text-muted", long && !open && "line-clamp-3")}>{combo.note}</p>
            {long && (
              <button type="button" onClick={() => setOpen((v) => !v)} className="mt-0.5 text-xs text-accent">
                {open ? "ย่อ" : "ดูเพิ่ม"}
              </button>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="min-w-0 truncate text-xs text-text-faint">{meta}</p>
          {live && <ReactionButtons likes={r.likes} dislikes={r.dislikes} value={r.value} disabled={r.pending} onChange={(n) => void r.react(n)} />}
        </div>
      </div>

      {mine && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 sm:px-4">
          <Switch checked={combo.isPublic} disabled={mine.busy || combo.hidden} onChange={mine.onPublic} label="เผยแพร่" />
          <div className="flex gap-1.5">
            <button type="button" aria-label="แก้ไข Combo" disabled={mine.busy} onClick={mine.onEdit} className={ICON_BTN}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" aria-label="ลบ Combo" disabled={mine.busy} onClick={mine.onDelete} className={cn(ICON_BTN, "hover:text-loss")}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
