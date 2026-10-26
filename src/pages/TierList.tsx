import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BarChart3, HelpCircle } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { ALL_LANES, getCuratedTierListsStrict } from "@/services/tierlist";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useToast } from "@/components/ui/toast";
import { Chip, RoleFilterRow, LaneFilterRow, TierFilterRow, ROLE_OPTIONS, LANE_OPTIONS, TIER_OPTIONS, useFilterLabels } from "@/features/heroes/HeroFilters";
import { getLatestPatch } from "@/services/meta";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { MyTierListWorkspace, type IncomingPreset } from "@/features/tierlist/MyTierListWorkspace";
import { CommunityTierLists, type PresetLoad } from "@/features/tierlist/CommunityTierLists";
import { editorHasUnsavedWork } from "@/features/tierlist/cloudTierList";
import { LaneGrid, useLaneColumns } from "@/features/tierlist/LaneGrid";
import { buildCuratedLaneGrid, buildLaneGrid, toShareTiers, type GridRowIn } from "@/features/tierlist/laneGrid";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { DraftOnboarding, useDraftOnboarding } from "@/features/draft/DraftOnboarding";
import { TIER_TOUR_KEY, TIER_TOUR_STEPS } from "@/features/tierlist/tierTour";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { ShareLinkButton } from "@/features/share/ShareLinkButton";
import { shortIdToUuid } from "@/features/share/shareId";
import { buildOfficialTierUrl } from "@/features/share/shareLink";
import { useShareImage } from "@/features/share/useShareImage";
import { formatGeneratedDate, makeFilename, preloadImages, tierLaneGridTemplate, type TierLaneGridImageData } from "@/lib/share-image";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { RANK_LABEL, setRank, useRank } from "@/lib/rank";
import type { HeroLane, HeroRole, HeroSummary, Tier } from "@/types/hero";

const TIER_ORDER: Tier[] = TIER_OPTIONS;

export type TierMode = "official" | "mine" | "community";

export function TierList() {
  const heroes = useAsync(() => getHeroes(), []);
  const rank = useRank();
  const toast = useToast();
  const navigate = useNavigate();
  // /tier-list/<id> = ลิงก์แชร์ของ Community Tier List; ?view=official&... = ลิงก์แชร์ของ Tier List ทางการ (ตัวกรอง)
  const { shareId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedUuid = useMemo(() => (shareId ? shortIdToUuid(shareId) : null), [shareId]);
  // จำค่าตัวกรองไว้แม้สลับแรงก์ (หน้าถูก remount เมื่อ rank เปลี่ยน) — ช่วงแรงก์สลับที่ปุ่มบน Header
  const [role, setRole] = usePersistedState<HeroRole | null>("rovlab:filter:tier:role", null);
  const [lane, setLane] = usePersistedState<HeroLane | null>("rovlab:filter:tier:lane", null);
  const [storedTier, setTier] = usePersistedState<Tier | null>("rovlab:filter:tier:tier", null);
  // โหมดหน้า: Tier List ทางการ / Tier List ของฉัน (จัดเอง + บันทึกบนบัญชีได้) / Community (ของคนอื่นที่เผยแพร่)
  const [storedMode, setMode] = usePersistedState<TierMode>("rovlab:tier:mode", "official");
  const mode: TierMode = shareId ? "community" : storedMode;
  // เปลี่ยนโหมดด้วยมือ = ออกจากลิงก์แชร์ (/tier-list/<id>) กลับ /tier-list
  const changeMode = useCallback(
    (m: TierMode) => {
      setMode(m);
      if (shareId) navigate("/tier-list", { replace: true });
    },
    [setMode, shareId, navigate]
  );
  // Tier List ที่โหลดมาจาก Community รอให้ตัวจัดอันดับรับไป
  const [incoming, setIncoming] = useState<IncomingPreset | null>(null);
  const { roleLabel, laneLabel } = useFilterLabels();
  // กันค่าเก่า/ค่าเสียใน sessionStorage ที่ไม่ตรงกับ Tier ปัจจุบัน → ถือเป็น "ทุก Tier"
  const tier = storedTier !== null && TIER_ORDER.includes(storedTier) ? storedTier : null;
  // Tier ที่แอดมินจัดเอง ครบทุกเลนในคำขอเดียว (cache ระดับแรงก์ entry เดียวกับเดิม: สลับเลน/โหมดกลับมาไม่ยิงซ้ำ)
  // อ่านไม่ได้ = error + ลองใหม่; null = ยังไม่มีลิสต์ → ใช้ tier จาก hero_stats แทน. โหลดเฉพาะโหมดทางการ
  const lists = useAsync(async () => (mode === "official" ? getCuratedTierListsStrict(rank) : null), [rank, mode]);
  const laneLists = lists.status === "success" ? lists.data : null;
  // ลิสต์ที่หน้านี้ใช้: มีตัวกรองเลน = ลิสต์ของเลนนั้น, ไม่มี = ลิสต์รวมทุกเลน (เหมือนเดิม)
  const tiers = laneLists?.get(lane ?? ALL_LANES) ?? null;
  // ไม่มีตัวกรองเลน + มีลิสต์รวม + แอดมินจัดรายเลนไว้อย่างน้อย 1 เลน → แต่ละเลนใช้ Tier ของเลนนั้นเอง
  const perLane = !lane && tiers !== null && laneLists !== null && [...laneLists.keys()].some((k) => k !== ALL_LANES);

  // ลิงก์ /tier-list/<id>: id เสีย = กลับหน้าปกติ; id ถูก = จำไว้ว่าอยู่แท็บ Community (ปิดหน้าต่างแล้วไม่เด้งไปแท็บอื่น)
  useEffect(() => {
    if (!shareId) return;
    if (!sharedUuid) {
      toast.error("ลิงก์ Tier List ไม่ถูกต้อง");
      navigate("/tier-list", { replace: true });
      return;
    }
    setMode("community");
  }, [shareId, sharedUuid, setMode, navigate, toast]);

  // ลิงก์ Tier List ทางการ: ?view=official&rank=high&role=mage&lane=mid&tier=S%2B → ตั้งตัวกรองตามลิงก์ แล้วลบพารามิเตอร์ออกจาก URL
  useEffect(() => {
    if (searchParams.get("view") !== "official") return;
    // รับเฉพาะค่าที่มีจริง (ค่าแปลกในลิงก์จะถูกมองเป็น "ทั้งหมด" ไม่ถูกเก็บลง storage จนหน้าว่าง)
    const rankParam = searchParams.get("rank");
    if (rankParam === "all" || rankParam === "high") setRank(rankParam);
    const roleParam = searchParams.get("role");
    const laneParam = searchParams.get("lane");
    setRole(ROLE_OPTIONS.find((o) => o.value === roleParam)?.value ?? null);
    setLane(LANE_OPTIONS.find((o) => o.value === laneParam)?.value ?? null);
    const t = searchParams.get("tier");
    setTier(TIER_ORDER.find((x) => x === t) ?? null);
    setMode("official");
    const next = new URLSearchParams(searchParams);
    for (const k of ["view", "rank", "role", "lane", "tier"]) next.delete(k);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setRole, setLane, setTier, setMode]);

  const grouped = useMemo(() => {
    // error ต้องไม่ตกไปใช้ hero_stats.tier (จะดูเหมือนเป็นลิสต์ทีมงาน) → ไม่มีข้อมูลให้จัดกลุ่ม แล้วหน้าแสดง ErrorState แทน
    if (heroes.status !== "success" || lists.status !== "success") return null;
    const filtered = heroes.data.filter((h) => {
      if (role !== null && !heroRoles(h).includes(role)) return false;
      // มีลิสต์ที่แอดมินจัด: แสดงเฉพาะฮีโร่ในลิสต์นั้น (ลิสต์รายเลนคือเลนนั้นอยู่แล้ว)
      if (tiers) {
        if (!tiers.has(h.id)) return false;
        return tier === null || tiers.get(h.id) === tier;
      }
      // fallback: tier จากสถิติ + กรองเลนจากอาร์เรย์ lanes
      if (!h.stat.hasStats || (lane !== null && !heroLanes(h).includes(lane))) return false;
      return tier === null || h.stat.tier === tier;
    });
    const map = new Map<Tier, typeof filtered>();
    for (const t of TIER_ORDER) map.set(t, []);
    for (const h of filtered) map.get(tiers ? tiers.get(h.id)! : h.stat.tier)?.push(h);
    // เรียง A-Z ตามชื่ออังกฤษ ไม่เรียงตาม Win Rate เพื่อไม่ให้ลำดับในช่องดูเหมือนอันดับความแข็ง
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return map;
  }, [heroes, lists.status, tiers, role, lane, tier]);

  // Tier x เลน: จัดกลุ่มจากข้อมูลในหน่วยความจำ (ไม่มีคำขอเพิ่ม) มีตัวกรองเลน = แสดงเลนเดียว
  // perLane = แต่ละเลนใช้ Tier รายเลนของแอดมิน (ฮีโร่เดียวอยู่ต่าง Tier ในต่างเลนได้); ไม่งั้นใช้ Tier เดียวต่อฮีโร่เหมือนเดิม
  const gridRows = useMemo<GridRowIn<HeroSummary>[]>(
    () => (grouped ? TIER_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0).map((t) => ({ id: t, label: t, heroes: grouped.get(t)! })) : []),
    [grouped]
  );
  const columns = useLaneColumns(lane);
  const grid = useMemo(() => {
    const codes = columns.map((c) => c.code);
    if (perLane && laneLists && heroes.status === "success") {
      const visible = heroes.data.filter((h) => role === null || heroRoles(h).includes(role));
      return buildCuratedLaneGrid(visible, laneLists, { lanes: codes, laneOf: heroLanes, tiers: TIER_ORDER, allKey: ALL_LANES, tier });
    }
    return buildLaneGrid(gridRows, { lanes: codes, laneOf: heroLanes, forceLane: lane });
  }, [perLane, laneLists, heroes, role, tier, columns, gridRows, lane]);

  const isCurated = lists.status === "success" && tiers !== null;
  const totalShown = perLane
    ? grid.rows.reduce((n, r) => n + r.unassigned.length + Object.values(r.cells).reduce((m, c) => m + c.length, 0), 0)
    : grouped
      ? [...grouped.values()].reduce((n, l) => n + l.length, 0)
      : 0;
  // แพตช์ล่าสุดจากตาราง patches (cache แล้ว) เพื่อให้ตรงกับลิสต์ที่แอดมินจัด แม้ยังไม่มีสถิติฮีโร่เลย; ไม่ได้ก็ใช้ค่าจากสถิติ
  const latestPatch = useAsync(() => getLatestPatch(), []);
  const statPatch = heroes.status === "success" ? heroes.data.find((h) => h.stat.hasStats)?.stat.patch : undefined;
  const patchLabel = (latestPatch.status === "success" ? latestPatch.data?.code : undefined) ?? statPatch ?? "—";
  const loading = heroes.status === "loading" || lists.status === "loading";
  // คู่มือใช้งานครั้งแรกของโหมด “Tier List ของฉัน” (ใช้ตัวทัวร์เดียวกับ Draft Assistant): เปิดเองเมื่อโหลดฮีโร่เสร็จและยังไม่เคยดู
  const tour = useDraftOnboarding(mode === "mine" && heroes.status === "success", TIER_TOUR_KEY);

  // รูปแชร์ของ Tier List ทางการ: ใช้ผลที่กรองอยู่ตอนนี้ (Role/Lane/Tier เดียวกับที่เห็นบนหน้า) ในรูปแบบ Tier x เลน จาก grid เดียวกับบนหน้าเว็บ
  const buildShare = useCallback(() => {
    const filterParts = [role ? roleLabel(role) : null, lane ? laneLabel(lane) : null].filter(Boolean);
    const data: TierLaneGridImageData = {
      title: "Tier List",
      patch: patchLabel,
      filterLabel: filterParts.length > 0 ? filterParts.join(" · ") : "All Roles",
      extraLabel: RANK_LABEL[rank],
      lanes: columns,
      tiers: toShareTiers(grid),
      generatedDate: formatGeneratedDate(),
    };
    return { data, filename: makeFilename("rovlab-tier-list"), title: "RoV LAB Tier List" };
  }, [grid, columns, patchLabel, rank, role, lane, roleLabel, laneLabel]);
  const share = useShareImage(tierLaneGridTemplate, buildShare);

  // ลิงก์ของ Tier List ทางการ = ตัวกรองที่ใช้อยู่ (ไม่ต้องเก็บอะไรลง DB ไม่ต้องล็อกอิน)
  const buildOfficialLink = useCallback(
    () => ({ url: buildOfficialTierUrl({ rank, role, lane, tier }), title: "RoV LAB Tier List" }),
    [rank, role, lane, tier]
  );

  // โหลดไอคอนล่วงหน้าเมื่อผู้ใช้เริ่มสนใจปุ่มแชร์ (hover/แตะ/โฟกัส) ไม่โหลดตอนเปิดหน้า — ผู้เข้าชมส่วนใหญ่ไม่กดแชร์ จึงไม่ต้องยิงคำขอไป R2 ทุกรูป
  // เรียกซ้ำได้: รูปที่โหลดแล้ว/กำลังโหลดไม่ถูกขอใหม่
  const preloadShareIcons = useCallback(() => {
    if (mode !== "official" || !grouped) return;
    preloadImages([...grouped.values()].flatMap((l) => l.map((h) => h.icon)));
  }, [mode, grouped]);

  // Load Preset จาก Community: สำเนาถูกสร้างแล้ว → เปิดในตัวจัดอันดับ (ต้นฉบับไม่ถูกแก้)
  const loadPreset = useCallback(
    (p: PresetLoad) => {
      setIncoming({ ...p, nonce: Date.now() });
      changeMode("mine");
    },
    [changeMode]
  );
  const canReplace = useCallback(
    async () =>
      !editorHasUnsavedWork() ||
      (await confirmDialog({
        title: "แทนที่ Tier List ปัจจุบัน?",
        message: "Tier List ปัจจุบันยังไม่ได้บันทึก ถ้าโหลดรายการนี้ การจัดอันดับที่ทำอยู่จะหายไป",
        confirmLabel: "โหลดแทน",
        danger: true,
      })),
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Tier List</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-faint">Patch {patchLabel} · {RANK_LABEL[rank]}</span>
            {mode === "mine" && heroes.status === "success" && (
              <button type="button" onClick={tour.show} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text">
                <HelpCircle className="h-4 w-4" />
                วิธีใช้งาน
              </button>
            )}
          </div>
        </div>
        {mode === "official" && (
          <p className="mt-1 text-xs text-text-faint">
            {isCurated ? "Tier จัดโดยทีมงาน" : "Tier คำนวณจาก Win Rate ของแรงก์ที่เลือก"} · แยกตามเลน · เรียง A–Z ในแต่ละช่อง · แตะไอคอนเพื่อดูข้อมูลฮีโร่
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="โหมด Tier List">
        <Chip active={mode === "official"} onClick={() => changeMode("official")} label="Tier List ทางการ" />
        <Chip active={mode === "mine"} onClick={() => changeMode("mine")} label="Tier List ของฉัน" />
        <Chip active={mode === "community"} onClick={() => changeMode("community")} label="Community" />
      </div>

      {(mode === "mine" || mode === "community") && (
        <>
          {heroes.status === "loading" && (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
              {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          )}
          {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
          {heroes.status === "success" && mode === "mine" && (
            <MyTierListWorkspace heroes={heroes.data} patch={patchLabel === "—" ? "" : patchLabel} incoming={incoming} />
          )}
          {heroes.status === "success" && mode === "community" && (
            <CommunityTierLists
              heroes={heroes.data}
              canReplace={canReplace}
              onLoadPreset={loadPreset}
              openId={sharedUuid}
              onOpenIdClosed={() => navigate("/tier-list", { replace: true })}
            />
          )}
        </>
      )}

      {mode === "official" && (
        <>
          <div className="space-y-2">
            <RoleFilterRow value={role} onChange={setRole} />
            <LaneFilterRow value={lane} onChange={setLane} />
            <TierFilterRow value={tier} onChange={setTier} />
          </div>

          {!loading && grouped && totalShown > 0 && (
            // display: contents = ไม่เปลี่ยนเลย์เอาต์ แค่ดักเหตุการณ์ที่ลอยขึ้นมาจากปุ่มแชร์เพื่อเริ่มโหลดไอคอน
            <div className="contents" onPointerEnter={preloadShareIcons} onPointerDown={preloadShareIcons} onFocus={preloadShareIcons}>
              <ShareImageButtons
                busy={share.busy}
                pending={share.pending}
                onShare={share.share}
                onDownload={share.download}
                extra={<ShareLinkButton build={buildOfficialLink} />}
              />
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
              {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          )}
          {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
          {/* ข้อความคงที่ ไม่แสดงข้อความ error จาก DB; ผลที่พลาดไม่ถูก cache กดลองใหม่จึงยิงคำขอใหม่จริง */}
          {lists.status === "error" && heroes.status !== "error" && (
            <ErrorState message="ไม่สามารถโหลด Tier List ทางการได้" onRetry={lists.refetch} />
          )}
          {!loading && heroes.status === "success" && lists.status === "success" && totalShown === 0 && (
            <EmptyState
              icon={BarChart3}
              title={isCurated || heroes.data.some((h) => h.stat.hasStats) ? "ไม่พบฮีโร่ในหมวดนี้" : "ยังไม่มีข้อมูลสถิติฮีโร่"}
              description={isCurated || heroes.data.some((h) => h.stat.hasStats) ? "ลองเปลี่ยนตัวกรอง Tier, Role หรือ Lane" : "ยังไม่มีสถิติสำหรับช่วงแรงก์ที่เลือก"}
            />
          )}
          {!loading && grouped && totalShown > 0 && <LaneGrid grid={grid} columns={columns} balanceBadge />}
        </>
      )}
      {tour.open && <DraftOnboarding steps={TIER_TOUR_STEPS} onClose={tour.close} />}
      <ConfirmHost />
    </div>
  );
}
