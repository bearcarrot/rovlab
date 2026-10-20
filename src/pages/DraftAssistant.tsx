import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bookmark, FilePlus2, HelpCircle, Link2, Search, Swords, Users } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getDraftRelations } from "@/services/draft";
import { getAllAbilities } from "@/services/abilities";
import { saveDraft, type MyDraft } from "@/services/draftSeries";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { useCoachQuickChats, type QuickChat } from "@/features/coach/CoachChatContext";
import { TeamSlots } from "@/features/draft/TeamSlots";
import { TeamMeters } from "@/features/draft/TeamMeters";
import { TeamGaps } from "@/features/draft/TeamGaps";
import { RecommendedPickCard } from "@/features/draft/RecommendedPickCard";
import { HeroPickButton } from "@/features/draft/HeroPickButton";
import { DraftShareBar } from "@/features/draft/DraftShareBar";
import { DraftLinkShare } from "@/features/draft/DraftLinkShare";
import { DraftOnboarding, useDraftOnboarding } from "@/features/draft/DraftOnboarding";
import {
  analyzeTeam,
  describeDraft,
  getDraftMode,
  recommendPicks,
  SKEW_MIN_HEROES,
  type DraftMode,
  type Recommendation,
} from "@/features/draft/analyzeTeam";
import { splitRecs } from "@/features/draft/splitRecs";
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
import { shortIdToUuid } from "@/features/share/shareId";
import { Modal } from "@/features/community/Modal";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { Chip, useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroLanes } from "@/lib/heroPositions";
import { heroMatchesQuery } from "@/lib/heroSearch";
import type { HeroLane, HeroSummary } from "@/types/hero";

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
  "ถ้ามี series.bans หรือ series.globalBpUsed ให้ถือว่าฮีโร่เหล่านั้นถูกแบน/ใช้ไปแล้ว ห้ามแนะนำให้เลือก " +
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
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // /draft/<id> = ลิงก์แชร์ของ Community Draft: เปิดแท็บ Community พร้อมหน้าต่างดู Draft นั้นทันที
  const { shareId } = useParams();
  const sharedUuid = useMemo(() => (shareId ? shortIdToUuid(shareId) : null), [shareId]);
  const rawTab = params.get("tab");
  const tab: Tab = shareId ? "community" : rawTab === "my" ? "my" : rawTab === "community" ? "community" : "editor";
  // เปลี่ยนแท็บด้วยมือ = ออกจากลิงก์แชร์ กลับ /draft
  const setTab = (t: Tab) => navigate(t === "editor" ? "/draft" : `/draft?tab=${t}`);

  const [active, setActive] = useState<Active | null>({ team: "mine", kind: "pick", index: 0 });
  const [query, setQuery] = useState("");
  // ให้ช่องค้นหาตอบสนองทันที ส่วนกริดฮีโร่ (~100+ ใบ) กรองตามค่าที่ตามหลังเล็กน้อย
  const deferredQuery = useDeferredValue(query);
  // คำตอบ Coach Ai ล่าสุดของปุ่มประเมินดราฟต์ (ใช้ใส่ในรูปแชร์เมื่อผู้ใช้เลือก)
  const [coachText, setCoachText] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginNotice, setLoginNotice] = useState(false);
  const filters = useHeroFilters();
  const { laneLabel } = useFilterLabels();
  // คู่มือใช้งานครั้งแรก: เปิดอัตโนมัติเมื่อ editor พร้อม (โหลดฮีโร่เสร็จ) และยังไม่เคยดู / เปิดซ้ำได้จากปุ่ม "วิธีใช้งาน"
  const onboarding = useDraftOnboarding(tab === "editor" && heroesQ.status === "success");

  // ลิงก์ /draft/<id> ที่ id เสีย → กลับหน้าปกติพร้อมแจ้งผู้ใช้
  useEffect(() => {
    if (shareId && !sharedUuid) {
      toast.error("ลิงก์ Draft ไม่ถูกต้อง");
      navigate("/draft", { replace: true });
    }
  }, [shareId, sharedUuid, navigate, toast]);

  // useAsync คืน object ใหม่ทุกเรนเดอร์ และ .data มีเฉพาะสถานะ success: ดึงค่าออกมาในที่ที่ narrow แล้ว แล้วใช้ค่านั้นเป็น dependency
  const heroesData = heroesQ.status === "success" ? heroesQ.data : undefined;
  const heroes = useMemo(() => heroesData ?? [], [heroesData]);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const relations = relQ.status === "success" ? relQ.data : undefined;
  const skillsData = skillsQ.status === "success" ? skillsQ.data : undefined;
  const skills = useMemo(() => skillsData ?? {}, [skillsData]);
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

  // ช่องที่มี slug แต่หาฮีโร่ไม่เจอ (ถูกเปลี่ยนชื่อ/ลบออกจากระบบ): ช่องจะดูเหมือนว่างแต่ slug ยังค้างและถูกบันทึกกลับไป
  // (ไม่ได้บล็อกฮีโร่ตัวไหน เพราะตัวนั้นไม่อยู่ในพูลอยู่แล้ว)
  const unknownPickCount = useMemo(() => {
    if (heroes.length === 0) return 0;
    return [...ds.game.mine.picks, ...ds.game.enemy.picks].filter((s) => !!s && !bySlug.has(s)).length;
  }, [heroes.length, ds.game.mine.picks, ds.game.enemy.picks, bySlug]);

  const analysis = useMemo(() => analyzeTeam(myTeam, kits), [myTeam, kits]);
  // ผลวิเคราะห์ทีมศัตรู ใช้เทียบในมิเตอร์ — แสดงเมื่อศัตรูมีอย่างน้อย SKEW_MIN_HEROES ตัว (น้อยกว่านั้นเทียบแล้วจะให้ภาพผิด)
  const enemyAnalysis = useMemo(() => analyzeTeam(enemyTeam, kits), [enemyTeam, kits]);
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
  // `recs` (top 5 รวม) ยังใช้กับรูปแชร์และปุ่ม Coach Ai; ที่แสดงบนหน้าใช้ชุดที่ตัดซ้ำแล้ว (ฮีโร่อยู่หมวดเดียว: ชนะทาง > คอมโบ > ภาพรวม)
  const {
    counter: counterRecs,
    synergy: synergyRecs,
    overall: overallRecs,
  } = useMemo(() => splitRecs(allRecs, RELATION_LIMIT, 5), [allRecs]);

  // ข้อมูลสกิล หรือคู่เคาน์เตอร์/คอมโบ ว่างทั้งที่โหลดเสร็จแล้ว (โหลดไม่ได้ หรือยังไม่ได้นำเข้า) → บอกผู้ใช้ว่าคำแนะนำอาจไม่ครบ
  // (service ทั้งสองไม่ throw เมื่อโหลดพลาด จึงตรวจจากข้อมูลที่ว่างแทนสถานะ error)
  const dataThin =
    skillsQ.status === "success" &&
    relQ.status === "success" &&
    (Object.keys(skills).length === 0 ||
      (relations !== undefined && relations.counters.length === 0 && relations.synergies.length === 0));

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

  // โหมดซีรีส์: บอก Coach Ai ว่าใครถูกแบน และใครถูกใช้ไปแล้วตามกฎ Global BP (โหมดเกมเดียวไม่ส่ง context เปลี่ยนไปจากเดิม)
  const seriesCtx = useMemo(() => {
    if (!seriesMode) return {};
    const names = (slugs: string[]) => slugs.map((s) => bySlug.get(s)?.nameTh).filter((n): n is string => !!n);
    const globalBp = isGlobalRuleActive(ds.series, ds.gameNumber);
    return {
      series: {
        game: ds.gameNumber,
        bans: { mine: names(ds.game.mine.bans), enemy: names(ds.game.enemy.bans) },
        ...(globalBp
          ? {
              globalBpUsed: {
                mine: restricted.mine.flatMap((r) => r.heroes.map((h) => h.nameTh)),
                enemy: restricted.enemy.flatMap((r) => r.heroes.map((h) => h.nameTh)),
              },
            }
          : {}),
      },
    };
  }, [seriesMode, bySlug, ds.series, ds.gameNumber, ds.game.mine.bans, ds.game.enemy.bans, restricted]);

  // context ของปุ่มประเมินดราฟต์: ข้อมูลภาพรวม + สกิลของทุกตัวที่เลือกไว้ (ย่อให้พอดีเพดาน 8000 ตัวอักษรของ edge function)
  const draftCoachCtx = useMemo(
    () =>
      buildDraftContext(
        { ...draftCtx, analysis, ...relationCtx, ...seriesCtx },
        { mine: mineList, enemies: enemyList, skills }
      ),
    [draftCtx, analysis, relationCtx, seriesCtx, mineList, enemyList, skills]
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
  const filteredPool = activePool.filter((h) => filters.match(h) && heroMatchesQuery(h, deferredQuery));

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

  // callback ตัวเดียวที่คงที่ให้ปุ่มฮีโร่ (memo) ใช้ — เรียก assign เวอร์ชันล่าสุดผ่าน ref จึงไม่ทำให้กริดเรนเดอร์ใหม่ทุกครั้ง
  const assignRef = useRef(assign);
  assignRef.current = assign;
  const onPickHero = useCallback((hero: HeroSummary) => assignRef.current(hero), []);

  function clearSlot(team: TeamKey, index: number) {
    ds.setPick(team, index, null);
  }

  // สลับ/ย้ายช่องในทีมเดียวกัน (ลากหรือปุ่มลูกศร) แล้วให้ช่องที่กำลังเลือกตามตัวฮีโร่ไป ไม่ชี้ผิดตัว
  function moveSlot(team: TeamKey, from: number, to: number) {
    if (from === to) return;
    ds.movePick(team, from, to);
    setActive((cur) => {
      if (!cur || cur.kind !== "pick" || cur.team !== team) return cur;
      if (cur.index === from) return { ...cur, index: to };
      if (cur.index === to) return { ...cur, index: from };
      return cur;
    });
    toast.success("สลับตำแหน่งแล้ว");
  }

  // ล้างช่องที่หาฮีโร่ไม่เจอ (เฉพาะเกมที่เปิดอยู่)
  function clearUnknownPicks() {
    for (const team of ["mine", "enemy"] as const) {
      ds.game[team].picks.forEach((s, i) => {
        if (s && !bySlug.has(s)) ds.setPick(team, i, null);
      });
    }
  }

  // กด "เลือกฮีโร่นี้" ในการ์ดแนะนำ → ใส่ช่องว่างช่องแรกของทีมเรา
  function pickForMyTeam(hero: HeroSummary) {
    const idx = myTeam.findIndex((h) => h === null);
    if (idx < 0) return;
    ds.setPick("mine", idx, hero.slug);
    // ถ้าช่องที่กำลังเลือกอยู่คือช่องที่เพิ่งถูกเติม ให้เลื่อนไปช่องว่างถัดไปเหมือนตอนเลือกจากกล่องตัวเลือก
    // (ไม่งั้นการกดฮีโร่ถัดไปจะไปทับตัวที่เพิ่งเลือก) — ถ้ากำลังเลือกช่องอื่น/โหมดแบน/ปิดกล่องอยู่ ไม่แตะต้อง
    setActive((cur) => {
      if (!cur || cur.kind !== "pick" || cur.team !== "mine" || cur.index !== idx) return cur;
      const nextEmpty = myTeam.findIndex((h, i) => h === null && i !== idx);
      return nextEmpty >= 0 ? { team: "mine", kind: "pick", index: nextEmpty } : null;
    });
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold">Draft Assistant</h1>
          <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ทีละช่อง ระบบจะประเมินคอมโพสิชันและแนะนำตัวถัดไป</p>
        </div>
        {tab === "editor" && heroesQ.status === "success" && (
          <button
            type="button"
            onClick={onboarding.show}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
          >
            <HelpCircle className="h-4 w-4" />
            วิธีใช้งาน
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="โหมด Draft">
        <Chip active={tab === "editor"} onClick={() => setTab("editor")} label="ดราฟต์" />
        <Chip active={tab === "my"} onClick={() => setTab("my")} label="Draft ของฉัน" />
        <Chip active={tab === "community"} onClick={() => setTab("community")} label="Community" />
      </div>

      {tab === "my" && <MyDrafts currentId={ds.draftId} onOpen={(d) => void openMyDraft(d)} onDeleted={(id) => id === ds.draftId && ds.detach()} />}
      {tab === "community" && (
        <CommunityDrafts
          heroes={heroes}
          canReplace={canReplace}
          onOpenCopy={openCopy}
          openId={sharedUuid}
          onOpenIdClosed={() => navigate("/draft?tab=community", { replace: true })}
        />
      )}

      {/* รอข้อมูลฮีโร่ก่อนแสดง editor: ไม่งั้นช่องที่กู้จาก session จะดูว่างแล้วค่อยเด้งขึ้นมา และ error จะมองไม่เห็นถ้ากล่องเลือกฮีโร่ปิดอยู่ */}
      {tab === "editor" && heroesQ.status === "loading" && <Skeleton className="h-64" />}
      {tab === "editor" && heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}

      {tab === "editor" && heroesQ.status === "success" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{ds.title || "Draft ใหม่"}</span>
              {ds.dirty && <span className="ml-2 text-xs text-amber-400">ยังไม่ได้บันทึก</span>}
            </p>
            <button
              type="button"
              data-tour="save"
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

          {unknownPickCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              <p className="min-w-0 flex-1 text-text-muted">
                มี {unknownPickCount} ช่องในเกมนี้ที่หาข้อมูลฮีโร่ไม่เจอแล้ว (อาจถูกเปลี่ยนชื่อหรือลบออกจากระบบ) ช่องเหล่านี้แสดงเป็นช่องว่าง แต่ข้อมูลยังค้างอยู่ใน Draft ที่บันทึก
              </p>
              <button
                type="button"
                onClick={clearUnknownPicks}
                className="rounded-lg border border-border px-3 py-1.5 text-text-muted hover:text-text"
              >
                ล้างช่องเหล่านี้
              </button>
            </div>
          )}

          {/* ยังไม่ได้เลือกฮีโร่สักตัว: บอกขั้นแรกให้ชัด */}
          {analysis.filledSlots === 0 && enemyList.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted">
              ยังไม่ได้เลือกฮีโร่ — แตะช่อง + ด้านล่างแล้วเลือกฮีโร่จากรายการ ระบบจะเริ่มวิเคราะห์ให้ทันที
            </p>
          )}

          {/* md+ วางทีมเรา/ทีมศัตรูคู่กัน บนมือถือยังเรียงลงมาเหมือนเดิม */}
          <div className="grid gap-5 md:grid-cols-2">
            {(["mine", "enemy"] as const).map((team) => (
              <div key={team}>
                <TeamSlots
                  label={TEAM_LABEL[team]}
                  teamId={team}
                  team={team === "mine" ? myTeam : enemyTeam}
                  activeIndex={active?.kind === "pick" && active.team === team ? active.index : null}
                  onSelectSlot={(i) => setActive({ team, kind: "pick", index: i })}
                  onClearSlot={(i) => clearSlot(team, i)}
                  onMove={(from, to) => moveSlot(team, from, to)}
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

          {/* แชร์ผลดราฟต์เป็นรูป PNG (สร้างในเบราว์เซอร์ ไม่อัปโหลดขึ้นเซิร์ฟเวอร์) — รูป = เกมที่เปิดอยู่ / ลิงก์ = ทั้งซีรีส์ */}
          <div data-tour="share">
            <DraftShareBar
              myTeam={myTeam}
              enemyTeam={enemyTeam}
              recs={teamFull ? [] : recs}
              analysis={analysis}
              mode={mode}
              coachText={analysis.filledSlots > 0 ? coachText : ""}
              linkShare={<DraftLinkShare ds={ds} onNeedLogin={() => setLoginNotice(true)} />}
            />
          </div>

          {active && (
            <div data-tour="picker" className="space-y-2 rounded-card border border-border bg-bg-surface p-3 sm:p-4">
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
              {filteredPool.length === 0 && <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>}
              {filteredPool.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 xl:grid-cols-9">
                  {filteredPool.map((h) => (
                    <HeroPickButton key={h.id} hero={h} onSelect={onPickHero} />
                  ))}
                </div>
              )}
            </div>
          )}

          <section>
            <h2 className="mb-2 font-display text-base font-semibold">ภาพรวมทีมของคุณ</h2>
            <TeamGaps gaps={gaps} filledSlots={analysis.filledSlots} />
            <div data-tour="meters" className="rounded-card border border-border bg-bg-surface p-4">
              <TeamMeters
                analysis={analysis}
                enemy={enemyAnalysis.filledSlots >= SKEW_MIN_HEROES ? enemyAnalysis : undefined}
              />
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

          <section data-tour="recs">
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-semibold">แนะนำตัวถัดไป (ภาพรวม)</h2>
            </div>
            <p className="mb-2 text-xs text-text-muted">{MODE_TEXT[mode]} · เป็นการประเมินเบื้องต้นจากสถิติและข้อมูลในระบบ</p>
            {dataThin && (
              <p className="mb-2 text-xs text-amber-400">
                ข้อมูลสกิลหรือคู่เคาน์เตอร์/คอมโบยังไม่พร้อม (โหลดไม่ได้หรือยังไม่มีข้อมูล) คำแนะนำและมิเตอร์ของทีมอาจไม่ครบ
              </p>
            )}
            {mineList.length > 0 && !teamFull && missingLanes.length > 0 && (
              <p className="mb-2 text-xs text-text-muted">
                เลนที่ยังขาด: {missingLanes.map((l) => laneLabel(l as HeroLane)).join(" · ")} — แนะนำเฉพาะฮีโร่ที่เล่นเลนเหล่านี้ได้
              </p>
            )}
            {teamFull ? (
              <p className="text-sm text-text-faint">ทีมของคุณครบ 5 ฮีโร่แล้ว</p>
            ) : overallRecs.length === 0 ? (
              <p className="text-sm text-text-faint">
                {recs.length === 0 ? "ยังไม่มีฮีโร่ให้แนะนำ" : "ฮีโร่ที่แนะนำทั้งหมดอยู่ในหมวดด้านบนแล้ว"}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {overallRecs.map((r) => (
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
        <Modal title="เข้าสู่ระบบก่อนบันทึกหรือแชร์ลิงก์" onClose={() => setLoginNotice(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-text-muted">ต้องเข้าสู่ระบบก่อนบันทึก Draft หรือสร้างลิงก์แชร์ Draft ที่กำลังทำอยู่จะยังอยู่ในหน้านี้ ไม่ถูกล้างเมื่อไปเข้าสู่ระบบ</p>
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
      {onboarding.open && <DraftOnboarding onClose={onboarding.close} />}
      <ConfirmHost />
    </div>
  );
}
