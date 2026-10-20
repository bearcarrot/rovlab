import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ClipboardList, Loader2, Upload } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { getItems } from "@/services/items";
import { trackActivity } from "@/services/activity";
import { MAX_SCAN_IMAGES, DuplicateMatchError, deleteMatch, findSameSlot, listMyMatches, saveMatch, scanScoreboards } from "@/services/matches";
import { fileToScoreboardBase64 } from "@/lib/image";
import { checkDraft, draftToRow, fingerprint, scanToDraft, type ScanDraft } from "@/features/matches/scan";
import { checkDuplicate, type DupCheck } from "@/features/matches/duplicate";
import { guessBlueRows, type SlotGuess } from "@/features/matches/itemMatch";
import { itemProvenance } from "@/features/matches/itemProvenance";
import { MatchAnalytics } from "@/features/matches/MatchAnalytics";
import { ScanReview } from "@/features/matches/ScanReview";
import { MyItemsEditor, type ItemSlots } from "@/features/matches/MyItemsEditor";
import { MatchCard } from "@/features/matches/MatchCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";
import type { ItemSummary } from "@/types/item";
import type { MatchRecord, MeSource } from "@/types/match";

const NO_HEROES: HeroSummary[] = [];
const NO_ITEMS: ItemSummary[] = [];
const NO_MATCHES: MatchRecord[] = [];
const NO_SLOTS: ItemSlots = [null, null, null, null, null, null];
const NO_TOUCHED: boolean[] = [false, false, false, false, false, false];
const MATCH_LOAD_LIMIT = 100; // how many of the newest matches are loaded; the analytics say so when this is reached

// One analysed screenshot waiting for the user's review (up to MAX_SCAN_IMAGES per upload, reviewed one after another).
// rows = the icon matcher's guesses for the 5 blue-team rows (null: could not read); edits = what the user changed, by blue row;
// touched = which slots of that row the user picked in (an explicit choice or confirmation, see itemProvenance).
// imageUrl = a blob: URL of the user's own file, only so they can compare it with the numbers; it is never uploaded or stored.
type ReviewItem = {
  draft: ScanDraft;
  initial: string;
  meSource: MeSource;
  rows: SlotGuess[][] | null;
  edits: Record<number, ItemSlots>;
  touched: Record<number, boolean[]>;
  imageUrl: string | null;
};

type Phase =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "review"; items: ReviewItem[]; index: number; remaining: number };

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

// Why saving was stopped. Any DupCheck that reaches the screen blocks the save: DUPLICATE and the same-time/other-data case
// would be rejected by the database anyway, and INDETERMINATE must not be waved through.
function dupMessage(c: DupCheck): string {
  if (c.status === "DUPLICATE") return "แมตช์นี้ถูกบันทึกไว้แล้ว (ข้อมูลตรงกันทุกช่อง) จึงไม่บันทึกซ้ำ";
  if (c.status === "INDETERMINATE")
    return "เทียบกับแมตช์ที่บันทึกไว้ไม่ได้ว่าซ้ำหรือไม่ เพราะมีข้อมูลที่เทียบไม่ได้ (เช่น ฮีโร่ที่ไม่พบในระบบ) ตรวจและเลือกฮีโร่ให้ครบก่อน";
  return "มีแมตช์ที่เวลาและความยาวเกมเท่ากันอยู่แล้ว แต่ข้อมูลบางช่องไม่ตรงกัน ระบบจะไม่บันทึกทับ ถ้าของเดิมอ่านผิด ให้ลบของเดิมแล้วบันทึกใหม่";
}

export function Matches() {
  const { user } = useAuth();
  const toast = useToast();
  const heroesQ = useAsync(() => getHeroes(), []);
  const itemsQ = useAsync(() => getItems(), []);
  const matchesQ = useAsync(() => listMyMatches(MATCH_LOAD_LIMIT), []);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false); // a ref, so two clicks in the same tick cannot both start a save
  const [dup, setDup] = useState<DupCheck | null>(null);
  const [showExisting, setShowExisting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MatchRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Opt-in to the anonymous community item statistics, asked per match and never pre-ticked.
  const [shareItems, setShareItems] = useState(false);
  // every blob: URL made for the review preview, so leaving the page frees them all
  const blobUrls = useRef<string[]>([]);
  useEffect(() => () => blobUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const heroes = heroesQ.status === "success" ? heroesQ.data : NO_HEROES;
  const itemList = itemsQ.status === "success" ? itemsQ.data : NO_ITEMS;
  const matches = matchesQ.status === "success" ? matchesQ.data : NO_MATCHES;
  const iconById = useMemo(() => new Map(heroes.map((h) => [h.id, h.icon])), [heroes]);
  const itemBySlug = useMemo(() => new Map(itemList.map((it) => [it.slug, it])), [itemList]);
  const current = phase.kind === "review" ? phase.items[phase.index] : null;
  const issues = useMemo(() => (current ? checkDraft(current.draft, heroes) : []), [current, heroes]);

  // The user's own row is always on the blue team; its position among the blue rows picks the icon guesses.
  const meRow = current ? current.draft.players.filter((p) => p.team === "blue").findIndex((p) => p.isMe) : -1;
  const mySlots: ItemSlots | null =
    current && meRow >= 0 ? (current.edits[meRow] ?? current.rows?.[meRow]?.map((g) => g.slug) ?? NO_SLOTS) : null;
  const myTouched = (current && meRow >= 0 ? current.touched[meRow] : undefined) ?? NO_TOUCHED;
  // Which slots would count in the community statistics (verified only); the database checks the same rule again.
  const prov = mySlots ? itemProvenance(mySlots, current?.rows?.[meRow] ?? null, myTouched) : null;

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow picking the same files again
    if (files.length === 0) return;
    if (files.length > MAX_SCAN_IMAGES) {
      toast.error(`เลือกได้ครั้งละไม่เกิน ${MAX_SCAN_IMAGES} รูป`);
      return;
    }
    setPhase({ kind: "scanning" });

    // Prepare on the device first. Files rejected here (not an image / not landscape) are never sent, so they are not
    // analysis attempts and cost no quota.
    const prepared: { name: string; base64: string; file: File }[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      try {
        prepared.push({ name: f.name, base64: await fileToScoreboardBase64(f), file: f });
      } catch (err) {
        rejected.push(files.length > 1 ? `${f.name}: ${messageOf(err, "อ่านไฟล์ไม่ได้")}` : messageOf(err, "อ่านไฟล์ไม่ได้"));
      }
    }
    if (rejected.length > 0) toast.error(rejected.join("; "));
    if (prepared.length === 0) {
      setPhase({ kind: "idle" });
      return;
    }

    try {
      const res = await scanScoreboards(prepared.map((p) => p.base64));
      // Item icons are read from the ORIGINAL file in the browser. Any failure there only means "no guesses" (rows = null).
      const catalogue = await getItems().catch(() => NO_ITEMS);
      const items: ReviewItem[] = [];
      const failed: string[] = [];
      for (const r of res.results) {
        void trackActivity("match_analysis_attempted", { ok: r.ok });
        if (r.ok) {
          const draft = scanToDraft(r.scan);
          const file = prepared[r.index - 1]?.file;
          const rows = file ? await guessBlueRows(file, catalogue) : null;
          // local preview only (never uploaded): lets the user compare the screenshot with what was read
          const imageUrl = file ? URL.createObjectURL(file) : null;
          if (imageUrl) blobUrls.current.push(imageUrl);
          items.push({ draft, initial: fingerprint(draft), meSource: r.meSource, rows, edits: {}, touched: {}, imageUrl });
        } else {
          const name = prepared[r.index - 1]?.name ?? `รูปที่ ${r.index}`;
          failed.push(prepared.length > 1 ? `${name}: ${r.error}` : r.error);
        }
      }
      if (failed.length > 0) toast.error(failed.join("; "));
      if (items.length === 0) {
        setPhase({ kind: "idle" });
        return;
      }
      setShareItems(false);
      setPhase({ kind: "review", items, index: 0, remaining: res.remaining });
    } catch (err) {
      prepared.forEach(() => void trackActivity("match_analysis_attempted", { ok: false }));
      toast.error(messageOf(err, "วิเคราะห์รูปไม่สำเร็จ"));
      setPhase({ kind: "idle" });
    }
  }

  /** Moves to the next screenshot in the batch, or back to the upload box after the last one. */
  function advance() {
    setDup(null);
    setShowExisting(false);
    setShareItems(false); // consent is asked again for every match
    if (current?.imageUrl) {
      URL.revokeObjectURL(current.imageUrl); // done with this picture
      blobUrls.current = blobUrls.current.filter((u) => u !== current.imageUrl);
    }
    setPhase((p) => (p.kind === "review" && p.index + 1 < p.items.length ? { ...p, index: p.index + 1 } : { kind: "idle" }));
  }

  function stopWith(c: DupCheck) {
    setDup(c);
    setShowExisting(false);
  }

  // Review -> normalize (draftToRow) -> check duplicate -> save. A failed check blocks the save (the catch below);
  // the database unique key (user_id, played_at, duration_sec) is the real guard against races and retries.
  async function onSave() {
    if (saveLock.current || phase.kind !== "review" || !current || !user) return;
    saveLock.current = true;
    setSaving(true);
    setDup(null);
    const edited = fingerprint(current.draft) !== current.initial;
    try {
      const row = draftToRow(current.draft, heroes, user.id, edited);
      const check = checkDuplicate(row, await findSameSlot(row.played_at, row.duration_sec));
      if (check.status !== "NOT_DUPLICATE" || check.existing) {
        stopWith(check);
        return;
      }
      // my_items is sent only when there is something to store (needs migration 20261013_match_my_items.sql). The user's own
      // history keeps every slot as shown. my_items_src/_margin and share_items need 20261020b_item_level_observations.sql;
      // share_items is sent only when the user ticked the box AND at least one slot is verified, and the database builds the
      // community observation from the verified slots only.
      const payload =
        mySlots && mySlots.some(Boolean)
          ? {
              ...row,
              my_items: mySlots,
              ...(prov ? { my_items_src: prov.src, my_items_margin: prov.margin } : {}),
              ...(shareItems && prov && prov.verified > 0 ? { share_items: true } : {}),
            }
          : row;
      try {
        await saveMatch(payload);
      } catch (err) {
        if (!(err instanceof DuplicateMatchError)) throw err;
        // Lost a race (or an earlier attempt actually went through): show what is saved instead of a bare error.
        const again = checkDuplicate(row, await findSameSlot(row.played_at, row.duration_sec));
        if (again.existing) {
          stopWith(again);
          return;
        }
        throw err;
      }
      // logged only here, after the insert has succeeded
      void trackActivity("match_saved", { edited });
      toast.success("บันทึกแมตช์แล้ว");
      matchesQ.refetch();
      advance();
    } catch (err) {
      toast.error(messageOf(err, "บันทึกแมตช์ไม่สำเร็จ"));
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }

  function requestDelete(id: string) {
    setPendingDelete(matches.find((m) => m.id === id) ?? (dup?.existing?.id === id ? dup.existing : null));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteMatch(pendingDelete.id);
      toast.success("ลบแมตช์แล้ว");
      setDup(null); // the blocking match is gone; the user can save again
      matchesQ.refetch();
    } catch (err) {
      toast.error(messageOf(err, "ลบแมตช์ไม่สำเร็จ"));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const scanning = phase.kind === "scanning";
  const batch = phase.kind === "review" && phase.items.length > 1 ? ` (${phase.index + 1}/${phase.items.length})` : "";

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
          <CardTitle>{phase.kind === "review" ? `ตรวจผลที่วิเคราะห์ได้${batch}` : "เพิ่มแมตช์จากรูป"}</CardTitle>
          {phase.kind === "review" && (
            <span className="text-xs text-text-faint">เหลือโควต้าวิเคราะห์วันนี้ {phase.remaining} รูป</span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {phase.kind === "review" && current ? (
            <>
              {current.imageUrl && (
                <details open className="rounded-lg border border-border bg-bg-surface">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-text-muted">
                    รูปของแมตช์นี้ (ไว้เทียบกับไอเทมและตัวเลขด้านล่าง)
                  </summary>
                  <div className="space-y-1.5 p-2">
                    <img
                      src={current.imageUrl}
                      alt="สกรีนชอตหน้าประวัติการเล่นของแมตช์นี้"
                      className="max-h-[60vh] w-full rounded-md border border-border object-contain"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-faint">
                      <span>แสดงจากไฟล์ในเครื่องคุณ ระบบไม่เก็บรูปไว้</span>
                      <a
                        href={current.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        เปิดภาพเต็ม (ซูมได้)
                      </a>
                    </div>
                  </div>
                </details>
              )}
              {mySlots && (
                <>
                  <MyItemsEditor
                    items={itemList}
                    value={mySlots}
                    guesses={current.rows?.[meRow] ?? null}
                    touched={myTouched}
                    onChange={(next, slot) =>
                      setPhase({
                        ...phase,
                        items: phase.items.map((it, i) => {
                          if (i !== phase.index) return it;
                          const t = [...(it.touched[meRow] ?? NO_TOUCHED)];
                          t[slot] = true;
                          return { ...it, edits: { ...it.edits, [meRow]: next }, touched: { ...it.touched, [meRow]: t } };
                        }),
                      })
                    }
                  />
                  {prov && prov.verified > 0 && (
                    <label className="flex items-start gap-2 text-xs text-text-muted">
                      <input
                        type="checkbox"
                        checked={shareItems}
                        onChange={(e) => setShareItems(e.target.checked)}
                        disabled={saving}
                        className="mt-0.5 h-4 w-4 accent-[#E8A33D]"
                      />
                      <span>
                        แชร์ไอเทมที่ยืนยันแล้วของแมตช์นี้ ({prov.verified} จาก 6 ช่อง) เข้าสถิติรวมของชุมชน ช่องที่ว่างหรือยังไม่ยืนยันจะไม่ถูกแชร์
                        (ไม่ระบุตัวตน ไม่มีชื่อ และเห็นเฉพาะตัวเลขรวมเมื่อมีผู้ร่วมแชร์หลายคน)
                        เลือกหรือไม่เลือกก็ไม่กระทบการบันทึกแมตช์ ดู{" "}
                        <a className="underline underline-offset-2" href="/privacy">Privacy Policy</a>
                      </span>
                    </label>
                  )}
                </>
              )}
              <ScanReview
                draft={current.draft}
                onChange={(draft) => {
                  setDup(null);
                  setPhase({ ...phase, items: phase.items.map((it, i) => (i === phase.index ? { ...it, draft } : it)) });
                }}
                heroes={heroes}
                issues={issues}
                meSource={current.meSource}
                saving={saving}
                onSave={onSave}
                onCancel={advance}
              />
              {dup && (
                <div role="alert" className="space-y-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                  <p className="font-medium text-accent">{dupMessage(dup)}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {dup.existing && (
                      <button
                        type="button"
                        onClick={() => setShowExisting((v) => !v)}
                        className="min-h-11 rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text hover:border-accent/40"
                      >
                        {showExisting ? "ซ่อนแมตช์ที่มีอยู่" : "ดูแมตช์ที่มีอยู่"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDup(null)}
                      className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
                    >
                      กลับไปตรวจ
                    </button>
                  </div>
                  {showExisting && dup.existing && (
                    <ul>
                      <MatchCard
                        match={dup.existing}
                        iconById={iconById}
                        itemBySlug={itemBySlug}
                        onDelete={requestDelete}
                        deleting={deleting}
                        defaultOpen
                      />
                    </ul>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start">
              <div className="space-y-3">
                <label
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-bg sm:inline-flex",
                    scanning && "pointer-events-none opacity-60"
                  )}
                >
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {scanning ? "กำลังวิเคราะห์" : "เลือกรูปสรุปผลการเล่น"}
                  <input type="file" accept="image/*" multiple onChange={onFiles} disabled={scanning} className="sr-only" />
                </label>
                <ul className="list-disc space-y-1 pl-5 text-xs text-text-muted">
                  <li>ใช้สกรีนชอตแนวนอนที่เห็นผู้เล่นครบ 10 คน (ไม่ต้องครอป ระบบตัดแถบ UID ด้านล่างทิ้งให้ก่อนส่ง)</li>
                  <li>เลือกได้สูงสุด {MAX_SCAN_IMAGES} รูปต่อครั้ง แล้วตรวจทีละแมตช์ โควต้าต่อวันนับตามจำนวนรูป</li>
                  <li>
                    รูปจะถูกส่งให้ Google Gemini อ่านตัวเลข ระบบไม่เก็บรูปต้นฉบับ และไม่บันทึกชื่อของผู้เล่นคนอื่น
                    (ดู <a className="underline underline-offset-2" href="/privacy">Privacy Policy</a>)
                  </li>
                  <li>ใส่ &ldquo;ชื่อในเกม&rdquo; ที่หน้าโปรไฟล์ไว้ ระบบจะหาแถวของคุณได้แม่นขึ้น</li>
                </ul>
              </div>
              {/* รูปตัวอย่าง: public/example/scoreboard-example.webp (ถ้าไม่มีไฟล์จะซ่อนทั้งกล่อง) */}
              <figure className="space-y-1">
                <img
                  src="/example/scoreboard-example.webp"
                  alt="ตัวอย่างหน้าสรุปผลการเล่นที่ใช้ได้"
                  width={1200}
                  height={532}
                  loading="lazy"
                  className="h-auto w-full rounded-lg border border-border"
                  onError={(e) => e.currentTarget.closest("figure")?.classList.add("hidden")}
                />
                <figcaption className="text-[11px] text-text-faint">
                  ตัวอย่าง: สกรีนชอตหน้า &ldquo;ประวัติการเล่น&rdquo; ที่เห็นผู้เล่นครบ 10 คน
                </figcaption>
              </figure>
            </div>
          )}
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

      {matches.length > 0 && <MatchAnalytics matches={matches} iconById={iconById} loadLimit={MATCH_LOAD_LIMIT} />}

      {matches.length > 0 && (
        <section aria-labelledby="list-heading" className="space-y-3">
          <h2 id="list-heading" className="font-display text-base font-semibold">แมตช์ที่บันทึก</h2>
          <ul className="space-y-2">
            {matches.map((m, idx) => (
              <MatchCard
                key={m.id}
                match={m}
                iconById={iconById}
                itemBySlug={itemBySlug}
                onDelete={requestDelete}
                deleting={deleting && pendingDelete?.id === m.id}
                defaultOpen={idx === 0}
              />
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="ลบแมตช์นี้?"
        description={
          pendingDelete
            ? `${pendingDelete.result === "victory" ? "ชนะ" : "แพ้"} ${pendingDelete.myHeroName} ${pendingDelete.kills}/${pendingDelete.deaths}/${pendingDelete.assists} แมตช์นี้จะหายไปจากสถิติของคุณ และกู้คืนไม่ได้`
            : ""
        }
        confirmLabel="ลบแมตช์"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
