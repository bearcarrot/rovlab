import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bookmark, FilePlus2, Link2, Search, Swords, Users } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getDraftRelations } from "@/services/draft";
import { getAllAbilities } from "@/services/abilities";
import { saveDraft, type MyDraft } from "@/services/draftSeries";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { useCoachQuickChats, type QuickChat } from "@/features/coach/CoachChatContext";
import { TeamSlots } from "@/features/draft/TeamSlots";
import { TeamMeters } from "@/features/draft/TeamMeters";
import { TeamGaps } from "@/features/draft/TeamGaps";
import { RecommendedPickCard } from "@/features/draft/RecommendedPickCard";
import { DraftShareBar } from "@/features/draft/DraftShareBar";
import {
  analyzeTeam,
  describeDraft,
  getDraftMode,
  recommendPicks,
  type DraftMode,
  type Recommendation,
} from "@/features/draft/analyzeTeam";
import { findTeamGaps } from "@/features/draft/teamGaps";
import { buildDraftContext, buildPickContext } from "@/features/draft/coachContext";
import { buildKits } from "@/features/draft/skillTags";
import { useDraftSession } from "@/features/draft/useDraftSession";
import {
  MAX_BANS,
  getAvailableHeroes,
  getCurrentGameTaken,
  getGlobalRestrictedHeroes,
  isGlobalRuleActive,
  type TeamKey,
} from "@/features/draft/series";
import { collectLanes, filterByMissingLanes, getMissingLanes } from "@/features/draft/laneCoverage";
import { SeriesBar } from "@/features/draft/SeriesBar";
import { GlobalRestrictionPanel, type RestrictedByGame } from "@/features/draft/GlobalRestrictionPanel";
import { BanRow } from "@/features/draft/BanRow";
import { SaveDraftDialog, type SaveDraftValues } from "@/features/draft/SaveDraftDialog";
import { MyDrafts } from "@/features/draft/MyDrafts";
import { CommunityDrafts } from "@/features/draft/CommunityDrafts";
import { Modal } from "@/features/community/Modal";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { Chip, useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroLanes } from "@/lib/heroPositions";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import type { HeroLane, HeroSummary } from "@/types/hero";
import { cn } from "@/lib/utils";

type Tab = "editor" | "my" | "community";
// ช่อง Pick (เดิม) หรือโหมดเลือกฮีโร่เพื่อแบน (เฉพาะโหมดซีรีส์)
type Active = { team: TeamKey; kind: "pick"; index: number } | { team: TeamKey; kind: "ban" };

const MODE_TEXT: Record<DraftMode, string> = {
  firstPick: "โหมด First Pick: ยังไม่เห็นทีมศัตรู จึงเน้นสถิติแพตช์ และเลี่ยงตัวที่โดนเคาน์เตอร์ง่าย",
  counter: "เน้นตัวที่ชนะทางศัตรู + คอมโบกับทีมเรา + เติมจุดที่ทีมขาด",
  composition: "เน้นเติมจุดที่ทีมขาด + คอมโบกับทีมเรา (เลือกทีมศัตรูเพิ่มเพื่อดูตัวชนะทาง)",
};

// จำนวนสูงสุดของรายการคอมโบ/ชนะทางที่แสดงแยก (รายการภาพรวมยังแสดง 5 อันดับแรก)
const RELATION_LIMIT = 6;

// จำนวนฮีโร่ที่แนะนำสูงสุดที่จะมีปุ่ม "ถามเรื่อง ..." ใน FAB Coach Ai (เรียงตามภาพรวม แล้วชนะทาง แล้วคอมโบ)
const PICK_CHAT_LIMIT = 5;

const DRAFT_PROMPT =
  "ประเมินดราฟต์นี้เป็นข้อๆ ไม่เกิน 6 ข้อ สั้นกระชับ: 1) จุดแข็งของทีมเรา 2) จุดที่ทีมยังขาด " +
  "3) คอมโบของสกิลในทีมเรา (อ้างชื่อสกิลจริงจาก heroes[].skills และใช้ teamCombos ถ้ามี) " +
  "4) สกิลศัตรูที่อันตรายที่สุดและวิธีหลบ/ตัดจังหวะด้วยสกิลของเรา (ใช้ matchups ถ้ามี) 5) แผนเล่นช่วงต้น-กลาง-ท้ายเกม " +
  "ใช้เฉพาะข้อมูลที่ให้ ห้ามแต่งสกิลหรือตัวเลขที่ไม่มีในข้อมูล ถ้าข้อมูลไม่พอให้บอกตรงๆ";

// prompt ถาม Coach Ai เรื่องฮีโร่ที่ระบบแนะนำตัวหนึ่ง (เดิมอยู่ในปุ่มบนการ์ดแนะนำ)
const pickPrompt = (name: string) =>
  `ตอบเป็นข้อๆ ไม่เกิน 6 ข้อ สั้นกระชับ เรื่องการเลือก ${name} ในดราฟต์นี้: ` +
  `1) ควรใช้สกิลไหนก่อน/หลัง และใช้ตอนไหน (อ้างชื่อสกิลจริงจาก heroes[].skills) ` +
  `2) ถ้ามี combos: อธิบายว่าสกิลของสองตัวเสริมกันยังไง (ใช้ข้อความ reason ถ้ามี และสกิลจริงประกอบ) ` +
  `3) ถ้ามี counters: direction=wins ให้บอกว่าศัตรูมีสกิลไหนที่ต้องหลบหรือตัดจังหวะ และเราใช้สกิลไหนสู้; ` +
  `direction=loses ให้บอกวิธีลดความเสียเปรียบ ` +
  `4) จุดที่ต้องระวัง ` +
  `ใช้เฉพาะข้อมูลที่ให้ ห้ามแต่งสกิลหรือตัวเลขที่ไม่มีในข้อมูล ถ้าข้อมูลสกิลไม่พอให้บอกตรงๆ`;

const TEAM_LABEL: Record<TeamKey, string> = { mine: "ทีมของคุณ", enemy: "ทีมศัตรู" };

function PickSection({
  icon,
  title,
  hint,
  recs,
  onPick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  recs: Recommendation[];
  onPick: (hero: HeroSummary) => void;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      <p className="mb-2 text-xs text-text-muted">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {recs.map((r) => (
          <RecommendedPickCard key={r.hero.id} rec={r} onPick={() => onPick(r.hero)} />
        ))}
      </div>
    </section>
  );
}

export function DraftAssistant() {
  const heroesQ = useAsync(() => getHeroes(), []);
  // ข้อมูล counter/synergy: โหลดไม่ได้ก็ไม่เป็นไร ระบบแนะนำยังทำงานด้วยสถิติ + คอมโพสิชัน
  const relQ = useAsync(() => getDraftRelations(), []);
  // สกิลของฮีโร่ทั้งหมด: ให้ Coach Ai อธิบายการใช้สกิล/คอมโบ/วิธีแก้ทางจากข้อมูลจริง (โหลดไม่ได้ = AI เห็นแค่ชื่อฮีโร่)
  // และใช้แท็กชนิดสกิล (ฟีล/โล่/บัฟ) ประเมินว่าทีมขาดอะไร
  const skillsQ = useAsync(() => getAllAbilities(), []);

  // สถานะดราฟต์ทั้งซีรีส์ (เกม/แบน/พิค) เก็บใน sessionStorage: ไม่หายเมื่อรีเฟรชหรือพาไปล็อกอิน
  const ds = useDraftSession();
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: Tab = rawTab === "my" ? "my" : rawTab === "community" ? "community" : "editor";
  const setTab = (t: Tab) => setParams(t === "editor" ? {} : { tab: t });

  const [active, setActive] = useState<Active | null>({ team: "mine", kind: "pick", index: 0 });
  const [query, setQuery] = useState("");
  // คำตอบ Coach Ai ล่าสุดของปุ่มประเมินดราฟต์ (ใช้ใส่ในรูปแชร์เมื่อผู้ใช้เลือก)
  const [coachText, setCoachText] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginNotice, setLoginNotice] = useState(false);
  const filters = useHeroFilters();
  const { laneLabel } = useFilterLabels();

  const heroes = useMemo(() => (heroesQ.status === "success" ? heroesQ.data : []), [heroesQ.status, heroesQ.data]);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const relations = relQ.status === "success" ? relQ.data : undefined;
  const skills = useMemo(() => (skillsQ.status === "success" ? skillsQ.data : {}), [skillsQ.status, skillsQ.data]);
  // ความสามารถของฮีโร่จากแท็กสกิลในเกม (ยังไม่นำเข้าแท็ก = ว่าง ระบบทำงานเหมือนเดิม)
  const kits = useMemo(() => buildKits(skills), [skills]);

  // ทีมของเกมที่เปิดอยู่ (ช่องว่าง = null) — ส่วนวิเคราะห์ด้านล่างใช้ค่าชุดนี้เหมือนเดิมทุกอย่าง
  const myTeam = useMemo(
    () => ds.game.mine.picks.map((s) => (s ? bySlug.get(s) ?? null : null)),
    [ds.game.mine.picks, bySlug]
  );
  const enemyTeam = useMemo(
    () => ds.game.enemy.picks.map((s) => (s ? bySlug.get(s) ?? null : null)),
    [ds.game.enemy.picks, bySlug]
  );
  const seriesMode = ds.series.format !== "single";

  const analysis = useMemo(() => analyzeTeam(myTeam, kits), [myTeam, kits]);
  // จุดที่ทีมยังขาด (แสดงเหนือแถบ meter) — เกณฑ์เดียวกับที่ระบบแนะนำใช้เติมจุดอ่อน
  const gaps = useMemo(() => findTeamGaps(analysis, myTeam, kits), [analysis, myTeam, kits]);
  const mode = getDraftMode(myTeam, enemyTeam);

  const mineList = useMemo(() => myTeam.filter((h): h is HeroSummary => h !== null), [myTeam]);
  const enemyList = useMemo(() => enemyTeam.filter((h): h is HeroSummary => h !== null), [enemyTeam]);

  // Global Ban Pick: ฮีโร่ที่ "ทีมนั้น" เคย Pick ในเกมก่อนหน้า แยกเป็นแถวต่อเกม (แยกทีม, แบนไม่นับ)
  const restricted = useMemo(() => {
    const rows = (team: TeamKey): RestrictedByGame[] =>
      ds.series.games
        .filter((g) => g.gameNumber < ds.gameNumber)
        .map((g) => ({
          gameNumber: g.gameNumber,
          heroes: g[team].picks.map((s) => (s ? bySlug.get(s) : undefined)).filter((h): h is HeroSummary => !!h),
        }));
    return { mine: rows("mine"), enemy: rows("enemy") };
  }, [ds.series, ds.gameNumber, bySlug]);

  // พูลที่ระบบแนะนำใช้: ตัดตัวที่ถูกใช้/แบนในเกมนี้ และตัวที่ทีมเราถูกห้ามซ้ำ แล้วค่อยคำนวณคำแนะนำ
  const minePool = useMemo(
    () => getAvailableHeroes({ heroes, series: ds.series, gameNumber: ds.gameNumber, team: "mine" }),
    [heroes, ds.series, ds.gameNumber]
  );

  // คำนวณทุกตัวครั้งเดียว แล้วแยกเป็น: ภาพรวม 5 อันดับ / คอมโบ / ชนะทาง
  // (คอมโบ/ชนะทางต้องไม่ถูกตัดด้วยอันดับ 5 เพราะคะแนนเติมจุดที่ขาดของตัวอื่นอาจสูงกว่า)
  const rawRecs = useMemo(
    () =>
      minePool.length
        ? recommendPicks(myTeam, minePool, { enemyTeam, relations, kits, limit: minePool.length })
        : [],
    [myTeam, enemyTeam, minePool, relations, kits]
  );
  // ระบบแนะนำรู้เลน: เลนที่ทีมเรามีฮีโร่ครอบแล้วจะไม่แนะนำตัวเลนเดียวกันอีก (เช่น มี Dolia ที่ Roaming แล้ว ไม่แนะนำ Thane ที่ Roaming)
  // ให้แนะนำเฉพาะตัวที่เล่นเลนที่ยังขาดได้ — ใช้กับทุกรายการแนะนำ (ภาพรวม / ชนะทาง / คอมโบ)
  const missingLanes = useMemo(
    () =>
      mineList.length === 0
        ? []
        : getMissingLanes(
            mineList.map((h) => heroLanes(h) as string[]),
            collectLanes(heroes.map((h) => heroLanes(h) as string[]))
          ),
    [mineList, heroes]
  );
  const allRecs = useMemo(
    () => filterByMissingLanes(rawRecs, (r) => heroLanes(r.hero) as string[], missingLanes),
    [rawRecs, missingLanes]
  );
  const recs = useMemo(() => allRecs.slice(0, 5), [allRecs]);
  const synergyRecs = useMemo(
    () => allRecs.filter((r) => r.tags.includes("synergy")).slice(0, RELATION_LIMIT),
    [allRecs]
  );
  const counterRecs = useMemo(
    () => allRecs.filter((r) => r.tags.includes("counter")).slice(0, RELATION_LIMIT),
    [allRecs]
  );

  const draftCtx = useMemo(
    () => ({
      mine: myTeam.map((h) => h?.nameTh ?? null),
      enemy: enemyTeam.map((h) => h?.nameTh ?? null),
    }),
    [myTeam, enemyTeam]
  );
  // เปลี่ยนทีมที่เลือก = ดราฟต์เปลี่ยน: ล้างบทสนทนาใน FAB (resetKey) และล้างคำตอบที่เคยใส่ในรูปแชร์
  const draftKey = JSON.stringify(draftCtx);
  useEffect(() => {
    setCoachText("");
  }, [draftKey]);
  // คอมโบในทีมเรา + เคาน์เตอร์ข้ามทีมพร้อมข้อความกลไก: Coach Ai อ้างอิงเฉพาะข้อมูลที่ส่งไป จึงต้องส่งไปด้วย
  const relationCtx = useMemo(() => describeDraft(myTeam, enemyTeam, relations), [myTeam, enemyTeam, relations]);

  // context ของปุ่มประเมินดราฟต์: ข้อมูลภาพรวม + สกิลของทุกตัวที่เลือกไว้ (ย่อให้พอดีเพดาน 8000 ตัวอักษรของ edge function)
  const draftCoachCtx = useMemo(
    () => buildDraftContext({ ...draftCtx, analysis, ...relationCtx }, { mine: mineList, enemies: enemyList, skills }),
    [draftCtx, analysis, relationCtx, mineList, enemyList, skills]
  );

  // พูลของตัวเลือกฮีโร่: pick = ไม่ซ้ำในเกมนี้ + ไม่ผิดกฎ Global BP ของทีมที่กำลังเลือก
  // ban = ไม่ซ้ำในเกมนี้ + ตัดตัวที่ "ทีมตรงข้าม" ใช้ไปแล้วในเกมก่อนหน้า (Global BP: ทีมนั้นเลือกซ้ำไม่ได้อยู่แล้ว จึงไม่ต้องแบนซ้ำ)
  const takenNow = useMemo(() => getCurrentGameTaken(ds.game), [ds.game]);
  const activePool = useMemo(() => {
    if (!active) return heroes;
    if (active.kind === "ban") {
      const opponent: TeamKey = active.team === "mine" ? "enemy" : "mine";
      const opponentUsed = getGlobalRestrictedHeroes({ series: ds.series, gameNumber: ds.gameNumber, team: opponent });
      return heroes.filter((h) => !takenNow.has(h.slug) && !opponentUsed.has(h.slug));
    }
    return getAvailableHeroes({ heroes, series: ds.series, gameNumber: ds.gameNumber, team: active.team });
  }, [active, heroes, takenNow, ds.series, ds.gameNumber]);
  const filteredPool = activePool.filter(
    (h) =>
      filters.match(h) &&
      (query.trim() === "" || h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase()))
  );

  const firstPick = (): Active => ({ team: "mine", kind: "pick", index: 0 });

  function assign(hero: HeroSummary) {
    if (!active) return;
    if (active.kind === "ban") {
      ds.addBan(active.team, hero.slug);
      if (ds.game[active.team].bans.length + 1 >= MAX_BANS) setActive(null);
      return;
    }
    ds.setPick(active.team, active.index, hero.slug);
    // auto-advance to next empty slot in the same team
    const team = active.team === "mine" ? myTeam : enemyTeam;
    const nextEmpty = team.findIndex((h, i) => h === null && i !== active.index);
    setActive(nextEmpty >= 0 ? { team: active.team, kind: "pick", index: nextEmpty } : null);
  }

  function clearSlot(team: TeamKey, index: number) {
    ds.setPick(team, index, null);
  }

  // กด "เลือกฮีโร่นี้" ในการ์ดแนะนำ → ใส่ช่องว่างช่องแรกของทีมเรา
  function pickForMyTeam(hero: HeroSummary) {
    const idx = myTeam.findIndex((h) => h === null);
    if (idx < 0) return;
    ds.setPick("mine", idx, hero.slug);
  }

  const teamFull = analysis.filledSlots === 5;

  // FAB Coach Ai: "ประเมินดราฟต์" (คำตอบถูกส่งไปใส่ในรูปแชร์ด้วย) + "ถามเรื่อง ..." ของฮีโร่ที่ระบบแนะนำ (เดิมเป็นปุ่มบนการ์ดแต่ละใบ)
  // memo ไว้เพื่อไม่ต้องสร้าง context/stringify ใหม่ทุกครั้งที่พิมพ์ค้นหา
  const coachChats = useMemo<QuickChat[]>(() => {
    if (analysis.filledSlots === 0) return [];
    const chats: QuickChat[] = [
      { id: "draft-eval", label: "ประเมินดราฟต์", prompt: DRAFT_PROMPT, context: draftCoachCtx, onAnswer: setCoachText },
    ];
    if (!teamFull) {
      const seen = new Set<string>();
      for (const r of [...recs, ...counterRecs, ...synergyRecs]) {
        if (seen.size >= PICK_CHAT_LIMIT) break;
        if (seen.has(r.hero.id)) continue;
        seen.add(r.hero.id);
        chats.push({
          id: `pick-${r.hero.slug}`,
          label: `ถามเรื่อง ${r.hero.nameTh}`,
          prompt: pickPrompt(r.hero.nameTh),
          // context ของฮีโร่ที่แนะนำ: สกิลจริงของตัวนั้น + คู่คอมโบ + ศัตรูที่เกี่ยวข้อง
          context: buildPickContext(r, { mine: mineList, enemies: enemyList, skills }),
        });
      }
    }
    return chats;
  }, [analysis.filledSlots, teamFull, recs, counterRecs, synergyRecs, draftCoachCtx, mineList, enemyList, skills]);
  useCoachQuickChats(coachChats, draftKey);

  // ---- บันทึก / โหลด ----
  // Draft ที่ยังไม่บันทึกจะไม่ถูกแทนที่เงียบๆ
  const canReplace = async () =>
    !(ds.dirty && !ds.isBlank) ||
    (await confirmDialog({
      title: "แทนที่ Draft ปัจจุบัน?",
      message: "Draft ปัจจุบันยังไม่ได้บันทึก ถ้าแทนที่ สิ่งที่ทำอยู่จะหายไป",
      confirmLabel: "แทนที่",
      danger: true,
    }));

  async function onNew() {
    if (!(await canReplace())) return;
    ds.startNew();
    setActive(firstPick());
    setCoachText("");
  }

  async function openMyDraft(d: MyDraft) {
    if (!(await canReplace())) return;
    ds.load({ series: d.series, draftId: d.id, title: d.name, description: d.description, visibility: d.visibility });
    setActive(firstPick());
    setCoachText("");
    setTab("editor");
    toast.success("โหลด Draft แล้ว");
  }

  function openCopy(c: { series: MyDraft["series"]; name: string; description: string; draftId: string | null }) {
    ds.load({ series: c.series, draftId: c.draftId, title: c.name, description: c.description, visibility: "private" });
    setActive(firstPick());
    setCoachText("");
    setTab("editor");
  }

  function onSaveClick() {
    if (!user) {
      setLoginNotice(true); // ไม่ล้าง Draft ปัจจุบัน: เก็บใน sessionStorage อยู่แล้ว
      return;
    }
    setSaveOpen(true);
  }

  async function doSave(v: SaveDraftValues, asCopy: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      const wasPublic = !asCopy && ds.draftId !== null && ds.visibility === "public";
      const id = await saveDraft({
        userId: user.id,
        id: asCopy ? null : ds.draftId,
        name: v.name,
        description: v.description,
        visibility: v.visibility,
        series: ds.series,
      });
      ds.markSaved({ draftId: id, title: v.name.trim(), description: v.description.trim(), visibility: v.visibility });
      setSaveOpen(false);
      if (v.visibility !== "public") toast.success("บันทึก Draft แล้ว");
      else if (wasPublic) toast.success("บันทึกแล้ว — Community ยังเป็นเวอร์ชันเดิม กด “อัปเดต” ที่ Draft ของฉันเพื่อเผยแพร่เวอร์ชันนี้");
      else toast.success("บันทึกและเผยแพร่ไปยัง Community แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Draft Assistant</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ทีละช่อง ระบบจะประเมินคอมโพสิชันและแนะนำตัวถัดไป</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="โหมด Draft">
        <Chip active={tab === "editor"} onClick={() => setTab("editor")} label="ดราฟต์" />
        <Chip active={tab === "my"} onClick={() => setTab("my")} label="Draft ของฉัน" />
        <Chip active={tab === "community"} onClick={() => setTab("community")} label="Community" />
      </div>

      {tab === "my" && <MyDrafts currentId={ds.draftId} onOpen={(d) => void openMyDraft(d)} onDeleted={(id) => id === ds.draftId && ds.detach()} />}
      {tab === "community" && <CommunityDrafts heroes={heroes} canReplace={canReplace} onOpenCopy={openCopy} />}

      {tab === "editor" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{ds.title || "Draft ใหม่"}</span>
              {ds.dirty && <span className="ml-2 text-xs text-amber-400">ยังไม่ได้บันทึก</span>}
            </p>
            <button
              type="button"
              onClick={onSaveClick}
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
            >
              <Bookmark className="h-4 w-4" />
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => void onNew()}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
            >
              <FilePlus2 className="h-4 w-4" />
              Draft ใหม่
            </button>
          </div>

          <SeriesBar ds={ds} heroName={(slug) => bySlug.get(slug)?.nameTh ?? slug} />

          {isGlobalRuleActive(ds.series, ds.gameNumber) && (
            <GlobalRestrictionPanel mine={restricted.mine} enemy={restricted.enemy} />
          )}

          {/* md+ วางทีมเรา/ทีมศัตรูคู่กัน บนมือถือยังเรียงลงมาเหมือนเดิม */}
          <div className="grid gap-5 md:grid-cols-2">
            {(["mine", "enemy"] as const).map((team) => (
              <div key={team}>
                <TeamSlots
                  label={TEAM_LABEL[team]}
                  team={team === "mine" ? myTeam : enemyTeam}
                  activeIndex={active?.kind === "pick" && active.team === team ? active.index : null}
                  onSelectSlot={(i) => setActive({ team, kind: "pick", index: i })}
                  onClearSlot={(i) => clearSlot(team, i)}
                />
                {seriesMode && (
                  <BanRow
                    label="แบน"
                    bans={ds.game[team].bans.map((slug) => ({ slug, hero: bySlug.get(slug) }))}
                    active={active?.kind === "ban" && active.team === team}
                    max={MAX_BANS}
                    onStart={() => setActive({ team, kind: "ban" })}
                    onRemove={(slug) => ds.removeBan(team, slug)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* แชร์ผลดราฟต์เป็นรูป PNG (สร้างในเบราว์เซอร์ ไม่อัปโหลดขึ้นเซิร์ฟเวอร์) — แชร์เกมที่เปิดอยู่ */}
          <DraftShareBar
            myTeam={myTeam}
            enemyTeam={enemyTeam}
            recs={teamFull ? [] : recs}
            analysis={analysis}
            mode={mode}
            coachText={analysis.filledSlots > 0 ? coachText : ""}
          />

          {active && (
            <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3 sm:p-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    active.kind === "ban"
                      ? `เลือกฮีโร่ที่จะแบน (${TEAM_LABEL[active.team]})`
                      : `เลือกฮีโร่สำหรับ ${TEAM_LABEL[active.team]} ช่อง ${active.index + 1}`
                  }
                  className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
                />
              </div>
              <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
              {heroesQ.status === "loading" && <Skeleton className="h-24" />}
              {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
              {heroesQ.status === "success" && filteredPool.length === 0 && (
                <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
              )}
              {heroesQ.status === "success" && filteredPool.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 xl:grid-cols-9">
                  {filteredPool.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => assign(h)}
                      className={cn(
                        "flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-border bg-bg p-0 pb-1 text-center hover:border-accent/40"
                      )}
                    >
                      <div className="relative flex aspect-square w-full items-center justify-center bg-bg-raised text-xs font-display text-text-faint">
                        {h.icon ? (
                          <img
                            src={h.icon}
                            alt={h.nameTh}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                        ) : null}

                        <span className={`text-sm font-display text-text-faint sm:text-base ${h.icon ? "hidden" : ""}`}>
                          {h.name.slice(0, 2).toUpperCase()}
                        </span>
                        {/* Tier มุมซ้ายบน และไอคอน buff/nerf/rework มุมขวาล่างแบบเดียวกับการ์ดในหน้าฮีโร่ทั้งหมด */}
                        <div className="absolute left-1.5 top-1.5">
                          {h.stat.hasStats ? <Badge tier={h.stat.tier}>{h.stat.tier}</Badge> : <Badge>N/A</Badge>}
                        </div>
                        <HeroBalanceBadge heroId={h.id} size="md" inside />
                      </div>
                      <span className="w-full truncate px-1 text-[11px] leading-tight sm:text-xs">{h.nameTh}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <section>
            <h2 className="mb-2 font-display text-base font-semibold">ภาพรวมทีมของคุณ</h2>
            <TeamGaps gaps={gaps} filledSlots={analysis.filledSlots} />
            <div className="rounded-card border border-border bg-bg-surface p-4">
              <TeamMeters analysis={analysis} />
            </div>

            {/* คอมโบที่เกิดขึ้นแล้วในทีมเรา: บอกกลไกตรงนี้เลย ไม่ต้องรอถาม AI */}
            {relationCtx.teamCombos.length > 0 && (
              <div className="mt-2 space-y-1.5 rounded-card border border-border bg-bg-surface p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <Link2 className="h-3.5 w-3.5 text-accent" /> คอมโบในทีมของคุณ
                </p>
                {relationCtx.teamCombos.map((c) => (
                  <p key={c.heroes.join("+")} className="text-text-muted">
                    <span className="text-text">{c.heroes[0]} + {c.heroes[1]}</span>
                    {c.reason ? `: ${c.reason}` : ": ยังไม่มีคำอธิบายกลไกในระบบ"}
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* ตัวที่ชนะทางศัตรู / คอมโบกับทีม: แสดงแยก ไม่ถูกตัดด้วย 5 อันดับภาพรวม */}
          {!teamFull && counterRecs.length > 0 && (
            <PickSection
              icon={<Swords className="h-4 w-4 text-accent" />}
              title="ชนะทางศัตรู"
              hint="ฮีโร่ที่ข้อมูลในระบบบอกว่าเคาน์เตอร์ตัวที่ศัตรูเลือกไปแล้ว"
              recs={counterRecs}
              onPick={pickForMyTeam}
            />
          )}
          {!teamFull && synergyRecs.length > 0 && (
            <PickSection
              icon={<Link2 className="h-4 w-4 text-accent" />}
              title="คอมโบกับทีมของคุณ"
              hint="ฮีโร่ที่เข้ากันกับตัวที่คุณเลือกไปแล้ว ตามข้อมูลซินเนอร์จี้ในระบบ"
              recs={synergyRecs}
              onPick={pickForMyTeam}
            />
          )}

          <section>
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-semibold">แนะนำตัวถัดไป (ภาพรวม)</h2>
            </div>
            <p className="mb-2 text-xs text-text-muted">{MODE_TEXT[mode]} · เป็นการประเมินเบื้องต้นจากสถิติและข้อมูลในระบบ</p>
            {mineList.length > 0 && !teamFull && missingLanes.length > 0 && (
              <p className="mb-2 text-xs text-text-muted">
                เลนที่ยังขาด: {missingLanes.map((l) => laneLabel(l as HeroLane)).join(" · ")} — แนะนำเฉพาะฮีโร่ที่เล่นเลนเหล่านี้ได้
              </p>
            )}
            {teamFull ? (
              <p className="text-sm text-text-faint">ทีมของคุณครบ 5 ฮีโร่แล้ว</p>
            ) : recs.length === 0 ? (
              <p className="text-sm text-text-faint">ยังไม่มีฮีโร่ให้แนะนำ</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recs.map((r) => (
                  <RecommendedPickCard key={r.hero.id} rec={r} onPick={() => pickForMyTeam(r.hero)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {saveOpen && (
        <SaveDraftDialog
          initial={{ name: ds.title, description: ds.description, visibility: ds.visibility }}
          editing={ds.draftId !== null}
          busy={saving}
          onCancel={() => setSaveOpen(false)}
          onSave={(v, asCopy) => void doSave(v, asCopy)}
        />
      )}
      {loginNotice && (
        <Modal title="เข้าสู่ระบบเพื่อบันทึก Draft" onClose={() => setLoginNotice(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-text-muted">ต้องเข้าสู่ระบบก่อนบันทึก Draft ไว้ในบัญชีของคุณ Draft ที่กำลังทำอยู่จะยังอยู่ในหน้านี้ ไม่ถูกล้างเมื่อไปเข้าสู่ระบบ</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLoginNotice(false)} className="rounded-lg border border-border px-3 py-2 text-text-muted hover:text-text">
                ยกเลิก
              </button>
              <Link to={withNext("/login", "/draft")} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmHost />
    </div>
  );
}
