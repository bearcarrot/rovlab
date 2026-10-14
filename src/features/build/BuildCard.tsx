import { Link } from "react-router-dom";
import { Thumb } from "@/features/admin/ImageSelect";
import { CompactBuild } from "@/features/build/buildView";
import { BuildReactions } from "@/features/build/BuildReactions";
import type { UserBuild } from "@/services/userBuilds";

const dateTh = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

// Community และ Build ของฉันใช้การ์ดเดียวกันแบบหน้าจอบิลด์ในเกม: หัวการ์ด (รูป+ชื่อผู้สร้าง กดไปหน้ารายละเอียดเพื่อแก้ไข-จัดการ) + แถวไอเทม/พลังแฝง/รูน
// ใช้ร่วมกันระหว่างหน้า Item Build และการ์ดบิลด์ในหน้ารายละเอียดฮีโร่; บิลด์ที่เผยแพร่แล้ว (และไม่ถูกซ่อน) มีปุ่ม ถูกใจ/ไม่ถูกใจ
export function BuildCard({ b, showHero }: { b: UserBuild; showHero: boolean }) {
  const who = b.author ? (b.author.displayName ?? `@${b.author.handle}`) : null;
  return (
    <article className="overflow-hidden rounded-card border border-border bg-bg-surface">
      <Link to={`/build/view/${b.id}`} className="flex items-center justify-between gap-2 p-3 transition hover:bg-bg-raised/50">
        <div className="flex min-w-0 items-center gap-2.5">
          <Thumb src={b.author?.avatarUrl ?? b.hero.icon} label={who ?? b.hero.nameTh} round className="h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight">{b.name}</p>
            <p className="truncate text-xs text-text-faint">
              {showHero ? `${b.hero.nameTh} · ` : ""}
              {who ? `โดย ${who} · ` : ""}
              {dateTh(b.isPublic ? b.publishedAt : b.updatedAt)}
            </p>
          </div>
        </div>
        {showHero && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${b.hidden ? "border-loss/40 text-loss" : b.isPublic ? "border-win/40 text-win" : "border-border text-text-faint"}`}>
            {b.hidden ? "ถูกซ่อน" : b.isPublic ? "เผยแพร่แล้ว" : "ส่วนตัว"}
          </span>
        )}
      </Link>
      <div className="space-y-3 border-t border-border p-3">
        <CompactBuild build={b.view} />
        {b.isPublic && !b.hidden && <BuildReactions b={b} />}
      </div>
    </article>
  );
}
