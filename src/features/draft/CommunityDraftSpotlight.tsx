import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThumbsUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseSeries, TEAM_SIZE, type HeroKey, type SeriesFormat } from "@/features/draft/series";
import { DraftPreviewPanel } from "@/features/draft/DraftPreviewPanel";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const FORMAT_LABEL: Record<SeriesFormat, string> = { single: "เกมเดียว", bo3: "BO3", bo5: "BO5", bo7: "BO7" };

interface TopDraft {
  id: string;
  title: string;
  likes: number;
  format: SeriesFormat;
  author: string;
  mine: HeroKey[];
  enemy: HeroKey[];
}

// ดราฟต์ชุมชนที่มียอดถูกใจสูงสุด: ใช้ RPC เดียวกับหน้า Draft (list_community_drafts)
// list_community_drafts คืนคอลัมน์ series เฉพาะเมื่อระบุ p_only_id เท่านั้น (แบบลิสต์คืน null)
// จึงต้องเรียก 2 ครั้ง: (1) หารายการที่ไลก์สูงสุด (2) ดึง series ของรายการนั้น
// RLS/RPC ซ่อนรายการที่ hidden อยู่แล้ว; ถ้าไม่มีรายการที่มีไลก์ ≥ 1 ให้คืน null (แสดงภาพประกอบเดิมแทน)
async function fetchTopLikedDraft(): Promise<TopDraft | null> {
  const list = await supabase.rpc("list_community_drafts", {
    p_sort: "liked",
    p_q: null,
    p_limit: 1,
    p_offset: 0,
  });
  if (list.error || !list.data?.length) return null;
  const top = list.data[0];
  const likes = Number(top.like_count ?? 0);
  if (likes < 1 || typeof top.id !== "string") return null;

  const one = await supabase.rpc("list_community_drafts", { p_only_id: top.id, p_limit: 1 });
  if (one.error || !one.data?.length) return null;
  const r = one.data[0];
  const series = parseSeries(r.series);
  const game = series?.games[0];
  if (!series || !game) return null;
  const keep = (picks: (HeroKey | null)[]) => picks.filter((h): h is HeroKey => h !== null);
  const mine = keep(game.mine.picks);
  if (mine.length === 0) return null;
  return {
    id: top.id,
    title: typeof r.title === "string" ? r.title : "",
    likes,
    format: series.format,
    author: typeof r.author_name === "string" ? r.author_name : "",
    mine,
    enemy: keep(game.enemy.picks),
  };
}

function TeamRow({ label, slugs, bySlug }: { label: string; slugs: HeroKey[]; bySlug: Map<string, HeroSummary> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-text-faint">{label}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: TEAM_SIZE }).map((_, i) => {
          const h = slugs[i] ? bySlug.get(slugs[i]) : undefined;
          return (
            <div key={i} className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-bg-raised">
              {h?.icon ? (
                <img
                  src={h.icon}
                  alt={h.nameTh}
                  title={h.nameTh}
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CommunityDraftSpotlight({ heroes }: { heroes: HeroSummary[] }) {
  const [top, setTop] = useState<TopDraft | null>(null);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);

  useEffect(() => {
    let cancelled = false;
    fetchTopLikedDraft()
      .then((d) => {
        if (!cancelled) setTop(d);
      })
      .catch(() => {
        if (!cancelled) setTop(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ยังโหลดอยู่ / ไม่มีดราฟต์ที่มียอดถูกใจ / error → ภาพประกอบเดิม (ไม่โชว์เลข 0 หรือกล่องว่าง)
  if (!top) return <DraftPreviewPanel />;

  return (
    <Link
      to={`/draft/${top.id}`}
      className={cn(
        "block min-h-[200px] space-y-3 rounded-card border border-border bg-bg-surface p-4 hover:border-accent/40",
        FOCUS
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-accent">ดราฟต์ยอดนิยมจากชุมชน</p>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-label={`${top.likes} ถูกใจ`}>{top.likes.toLocaleString("th-TH")}</span>
        </span>
      </div>
      <div>
        <p className="truncate font-display text-sm font-medium">{top.title || "ดราฟต์ไม่มีชื่อ"}</p>
        <p className="truncate text-[11px] text-text-faint">
          {FORMAT_LABEL[top.format]} · เกมที่ 1{top.author ? ` · โดย ${top.author}` : ""}
        </p>
      </div>
      <div className="space-y-2">
        <TeamRow label="ทีมเรา" slugs={top.mine} bySlug={bySlug} />
        {top.enemy.length > 0 && <TeamRow label="ทีมศัตรู" slugs={top.enemy} bySlug={bySlug} />}
      </div>
    </Link>
  );
}
