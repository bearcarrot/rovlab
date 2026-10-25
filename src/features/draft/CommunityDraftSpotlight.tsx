import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThumbsUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseEffectTags } from "@/lib/effectTags";
import type { AbilitiesByHero } from "@/services/abilities";
import { parseSeries, TEAM_SIZE, type HeroKey, type SeriesFormat } from "@/features/draft/series";
import { analyzeTeam } from "@/features/draft/analyzeTeam";
import { findTeamGaps } from "@/features/draft/teamGaps";
import { buildKits, type KitsByHero } from "@/features/draft/skillTags";
import { DraftPreviewPanel } from "@/features/draft/DraftPreviewPanel";
import { HeroIcon } from "@/components/HeroIcon";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const FORMAT_LABEL: Record<SeriesFormat, string> = { single: "เกมเดียว", bo3: "BO3", bo5: "BO5", bo7: "BO7" };

// 3 มิติเดียวกับกราฟตัวอย่างเดิมบน Home (ไม่ใช้ครบ 6 แถวเหมือนหน้า Draft เพื่อไม่ให้การ์ดยาว)
// gap = key ของ findTeamGaps ที่ชี้ว่ามิตินั้น "ขาด" (ความคล่องตัวไม่มีเกณฑ์ขาด)
const METERS = [
  { key: "frontline", label: "แนวหน้า", gap: "frontline" },
  { key: "cc", label: "Crowd Control", gap: "cc" },
  { key: "mobility", label: "ความคล่องตัว", gap: null },
] as const;
const METER_MAX = 10; // เพดานสเกลแถบเท่ากับ TeamMeters บนหน้า Draft

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

// แท็กสกิลของเฉพาะฮีโร่ที่อยู่ในทีม (ประมาณ 20 แถว ไม่ใช้ getAllAbilities ที่โหลดทั้งตาราง ~600 แถวพร้อมคำอธิบาย)
// สร้าง kits ด้วย buildKits ตัวเดียวกับหน้า Draft (buildKits ใช้เฉพาะ slot + effectTags จึงไม่ต้องดึง name/description)
// ล้มเหลว → null (กลับไปคำนวณจาก Role) ไม่ทำให้การ์ดหาย
async function fetchKits(heroIds: string[]): Promise<KitsByHero | null> {
  if (heroIds.length === 0) return null;
  const { data, error } = await supabase.from("hero_abilities").select("hero_id, slot, effect_tags").in("hero_id", heroIds);
  if (error || !data) return null;
  const skills: AbilitiesByHero = {};
  for (const r of data as any[]) {
    (skills[r.hero_id as string] ??= []).push({
      slot: String(r.slot ?? ""),
      name: "",
      description: "",
      effectTags: parseEffectTags(r.effect_tags).map((t) => t.name),
    });
  }
  return buildKits(skills);
}

// ไอคอนขยายตามความกว้างการ์ด (grid 5 คอลัมน์, aspect-square) แทนขนาด 32px คงที่ มือถือไม่เหลือที่ว่างขวา
// max-w-72 จำกัดไม่ให้ไอคอนใหญ่เกินไปบนจอกว้าง
// ใช้ HeroIcon ตัวเดียวกับทุกหน้า (URL เดียวกัน แคชร่วมกัน, lazy, มีตัวอักษรย่อเมื่อรูปโหลดไม่ได้)
function TeamRow({ label, slugs, bySlug }: { label: string; slugs: HeroKey[]; bySlug: Map<string, HeroSummary> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-text-faint">{label}</span>
      <div className="grid max-w-72 flex-1 grid-cols-5 gap-1.5">
        {Array.from({ length: TEAM_SIZE }).map((_, i) => {
          const h = slugs[i] ? bySlug.get(slugs[i]) : undefined;
          return (
            <div key={i} title={h?.nameTh}>
              <HeroIcon
                icon={h?.icon}
                name={h?.nameTh ?? ""}
                fallback={h ? h.name.slice(0, 2).toUpperCase() : ""}
                decorative={!h}
                className="aspect-square h-auto w-full rounded-md"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CommunityDraftSpotlight({ heroes }: { heroes: HeroSummary[] }) {
  const [top, setTop] = useState<TopDraft | null>(null);
  const [kits, setKits] = useState<KitsByHero | null>(null);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);

  // โหลดดราฟต์ก่อน แล้วจึงดึงแท็กสกิลของทีมนั้น แล้ว set พร้อมกัน การ์ดจะขึ้นครั้งเดียว ไม่กระพริบจากค่า Role เป็นค่าจากสกิล
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await fetchTopLikedDraft();
      if (!d) {
        if (!cancelled) setTop(null);
        return;
      }
      const ids = d.mine.map((s) => bySlug.get(s)?.id).filter((id): id is string => id !== undefined);
      const k = await fetchKits(ids).catch(() => null);
      if (!cancelled) {
        setKits(k);
        setTop(d);
      }
    })().catch(() => {
      if (!cancelled) setTop(null);
    });
    return () => {
      cancelled = true;
    };
  }, [bySlug]);

  // สถิติของทีมฝั่งผู้สร้าง (เกมที่ 1) ใช้ analyzeTeam/findTeamGaps + kits เหมือนหน้า Draft
  // ถ้าฮีโร่บางตัวไม่มีแท็กสกิล analyzeTeam จะ fallback ไปใช้ Role เฉพาะตัวนั้นเอง
  // ถ้าหาฮีโร่บางตัวไม่เจอในรายชื่อ จะไม่แสดงแถบสถิติ (แทนที่จะคำนวณผิด)
  const teamStats = useMemo(() => {
    if (!top) return null;
    const picked = top.mine.map((s) => bySlug.get(s));
    const mineHeroes = picked.filter((h): h is HeroSummary => h !== undefined);
    if (mineHeroes.length === 0 || mineHeroes.length < picked.length) return null;
    const analysis = analyzeTeam(mineHeroes, kits ?? undefined);
    // ระบุว่า "ขาด" เฉพาะทีมครบ 5 ตัว ทีมที่ยังไม่ครบจะขาดอยู่แล้วโดยธรรมชาติ
    const full = mineHeroes.length >= TEAM_SIZE;
    const gaps = full ? new Set(findTeamGaps(analysis, mineHeroes, kits ?? undefined).map((g) => g.key)) : new Set<string>();
    // ทุกตัวมีแท็กสกิล = คำนวณจากสกิลครบ; ไม่ครบ = ผสม Role บางตัว
    const fromKits = kits !== null && mineHeroes.every((h) => kits[h.id] !== undefined);
    return { analysis, gaps, fromKits };
  }, [top, kits, bySlug]);

  // ยังโหลดอยู่ / ไม่มีดราฟต์ที่มียอดถูกใจ / error → ภาพประกอบเดิม (ไม่โชว์เลข 0 หรือกล่องว่าง)
  if (!top) return <DraftPreviewPanel />;

  return (
    <Link
      to={`/draft/${top.id}`}
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-bg-surface p-4 hover:border-accent/40",
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
      {teamStats && (
        <div className="space-y-2 border-t border-border pt-3">
          {METERS.map((m) => {
            const isGap = m.gap !== null && teamStats.gaps.has(m.gap);
            return (
              <div key={m.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-text-muted">{m.label}</span>
                  {isGap && <span className="font-medium text-loss">ขาด</span>}
                </div>
                <Progress value={(teamStats.analysis[m.key] / METER_MAX) * 100} barClassName={isGap ? "bg-loss" : undefined} />
              </div>
            );
          })}
          <p className="pt-0.5 text-[11px] text-text-faint">
            {teamStats.fromKits
              ? "* ประเมินจากแท็กสกิลของทีมเรา (บางมิติยังเป็น Heuristic จาก Role)"
              : "* ประเมินจาก Role ของทีมเรา (Heuristic) ยังไม่ใช่ข้อมูลระดับสกิล"}
          </p>
        </div>
      )}
    </Link>
  );
}
