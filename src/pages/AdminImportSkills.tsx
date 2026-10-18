/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FileUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { GameFetchCard, type GameHero } from "@/features/admin/GameFetchCard";
import { buildAbilityRows, parseSkillsMap, type AbilityRow, type Existing, type Skill } from "@/lib/skills";

// client แบบ untyped เพราะเรียกตารางที่ไม่มี generated types
const db: any = supabase;

type DbHero = { id: string; name: string; name_th: string | null; hero_id: number | null };
type Prepared = { gameId: number; heroUuid: string; name: string; skills: Skill[]; rows: AbilityRow[]; ex: number; skipped: number };

const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";
const CHUNK = 200;

export function AdminImportSkills() {
  const toast = useToast();
  const [heroes, setHeroes] = useState<DbHero[]>([]);
  const [existing, setExisting] = useState<Map<string, Existing>>(new Map()); // "<hero uuid>|<slot>" → ชื่อ/ไอคอนเดิม
  const [fetched, setFetched] = useState<Map<number, Skill[]>>(new Map());
  const [fileName, setFileName] = useState("");
  const [overwriteName, setOverwriteName] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const h = await db.from("heroes").select("id,name,name_th,hero_id").order("name");
    if (h.error) toast.error(`โหลดรายชื่อฮีโร่ไม่สำเร็จ: ${h.error.message}`);
    setHeroes((h.data ?? []) as DbHero[]);
    // PostgREST ตอบทีละไม่เกิน 1000 แถว จึงอ่านเป็นหน้า ๆ
    const all: { hero_id: string; slot: string; name: string; icon_url: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await db.from("hero_abilities").select("hero_id,slot,name,icon_url").order("hero_id").order("slot").range(from, from + 999);
      if (r.error) {
        toast.error(`โหลดสกิลเดิมไม่สำเร็จ: ${r.error.message}`);
        break;
      }
      all.push(...r.data);
      if (r.data.length < 1000) break;
    }
    setExisting(new Map(all.map((a) => [`${a.hero_id}|${a.slot}`, { name: a.name, icon_url: a.icon_url }])));
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const byGame = useMemo(() => new Map(heroes.filter((h) => h.hero_id != null).map((h) => [h.hero_id as number, h])), [heroes]);
  const gameHeroes: GameHero[] = useMemo(
    () => heroes.filter((h) => h.hero_id != null).map((h) => ({ id: h.hero_id as number, name: h.name || h.name_th || String(h.hero_id) })),
    [heroes]
  );

  // ข้อมูลที่ดึง/อัปโหลดมา → แถวที่จะบันทึก (จับคู่ฮีโร่ด้วย heroes.hero_id)
  const { prepared, unmatched } = useMemo(() => {
    const prepared: Prepared[] = [];
    const unmatched: number[] = [];
    for (const [gameId, skills] of fetched) {
      const hero = byGame.get(gameId);
      if (!hero) {
        unmatched.push(gameId);
        continue;
      }
      const old = new Map<string, Existing>();
      for (const [k, v] of existing) if (k.startsWith(`${hero.id}|`)) old.set(k.slice(hero.id.length + 1), v);
      const b = buildAbilityRows(gameId, skills, old, overwriteName);
      prepared.push({ gameId, heroUuid: hero.id, name: hero.name || hero.name_th || String(gameId), skills, ...b });
    }
    prepared.sort((a, b) => a.name.localeCompare(b.name));
    return { prepared, unmatched };
  }, [fetched, byGame, existing, overwriteName]);

  const totalRows = prepared.reduce((n, p) => n + p.rows.length, 0);

  function onFetched(text: string) {
    setConfirming(false);
    try {
      const m = parseSkillsMap(text);
      setFetched((cur) => new Map([...cur, ...m]));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    onFetched(await f.text());
  }

  async function runImport() {
    setBusy(true);
    setConfirming(false);
    const rows = prepared.flatMap((p) =>
      p.rows.map((r) => ({
        hero_id: p.heroUuid,
        slot: r.slot,
        name: r.name,
        description: r.description,
        sort_order: r.sort_order,
        icon_url: r.icon_url,
        effect_tags: r.effect_tags,
      }))
    );
    let ok = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await db.from("hero_abilities").upsert(chunk, { onConflict: "hero_id,slot" });
      if (error) {
        setBusy(false);
        toast.error(`นำเข้าไม่สำเร็จ: ${error.message}${ok > 0 ? ` (บันทึกไปแล้ว ${ok} แถว)` : ""}`);
        return;
      }
      ok += chunk.length;
    }
    setBusy(false);
    const ex = prepared.reduce((n, p) => n + p.ex, 0);
    const skipped = prepared.reduce((n, p) => n + p.skipped, 0);
    toast.success(`นำเข้าสกิลแล้ว ${ok} แถว จาก ${prepared.length} ฮีโร่${ex ? ` (ร่างเสริม -ex ${ex})` : ""}${skipped ? ` · ข้าม ${skipped} สกิลที่ไม่ใช่ช่อง passive/1-4` : ""}`);
    if (unmatched.length > 0) toast.error(`ข้าม ${unmatched.length} ตัวที่ไม่มีฮีโร่ hero_id นี้ในฐานข้อมูล: ${unmatched.join(", ")}`);
    setFetched(new Map());
    setFileName("");
    void load();
  }

  return (
    <div className="space-y-4 pb-24">
      <GameFetchCard kind="skills" heroes={gameHeroes} onFetched={onFetched} />

      <section className={card}>
        <h2 className="font-display text-base font-semibold">หรือเลือกไฟล์ skills.json</h2>
        <p className="text-xs text-text-muted">
          ไฟล์ที่ได้จากหน้า index.php เดิม (หรือ JSON ผลตอบกลับของเกมในรูป {"{ hero_id: ผลตอบกลับ }"}) อ่านบนเครื่องคุณเท่านั้น
        </p>
        <label className={`${btn} w-full cursor-pointer border border-border bg-bg-raised text-text hover:border-text-faint sm:w-auto`}>
          <FileUp className="h-4 w-4" /> {fileName || "เลือกไฟล์"}
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      </section>

      {fetched.size > 0 && (
        <section className={card}>
          <h2 className="font-display text-base font-semibold">ตรวจทานก่อนนำเข้า</h2>
          <p className="flex items-start gap-1.5 text-sm text-win">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              พร้อมนำเข้า {prepared.length} ฮีโร่ · {totalRows} แถว
              {unmatched.length > 0 && ` · จับคู่ไม่ได้ ${unmatched.length} ตัว (จะถูกข้าม)`}
            </span>
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-bg-raised text-text-muted">
                <tr>
                  <th className="px-2 py-1.5">ฮีโร่</th>
                  <th className="px-2 py-1.5 text-right">สกิล</th>
                  <th className="px-2 py-1.5 text-right">-ex</th>
                  <th className="px-2 py-1.5 text-right">ไอคอน</th>
                </tr>
              </thead>
              <tbody>
                {prepared.map((p) => (
                  <tr key={p.gameId} className="border-t border-border">
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5 text-right">{p.rows.length}</td>
                    <td className="px-2 py-1.5 text-right">{p.ex || "-"}</td>
                    <td className="px-2 py-1.5 text-right">{p.rows.filter((r) => r.icon_url).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-raised p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent,#3b82f6)]"
              checked={overwriteName}
              onChange={(e) => setOverwriteName(e.target.checked)}
            />
            <span className="text-sm">
              ทับชื่อสกิลเดิมด้วยชื่อจากเกม
              <span className="mt-0.5 block text-xs text-text-muted">
                ปิดไว้ = คงชื่อที่มีอยู่ในฐานข้อมูล (ถ้าไม่เคยมีจะใช้ชื่อจากเกม) · คำอธิบาย ไอคอน และแท็กอัปเดตตามเกมเสมอ ถ้าเกมไม่ส่งไอคอนจะคงไอคอนเดิม
              </span>
            </span>
          </label>

          {!confirming ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy || prepared.length === 0}
                onClick={() => setConfirming(true)}
                className={`${btn} w-full bg-accent text-accent-fg hover:brightness-110 sm:w-auto`}
              >
                นำเข้า {totalRows} แถว
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFetched(new Map());
                  setFileName("");
                }}
                className={`${btn} w-full border border-border bg-bg-raised hover:border-text-faint sm:w-auto`}
              >
                ล้างรายการ
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-accent/40 bg-bg-raised p-3">
              <p className="text-sm">
                จะบันทึก {totalRows} แถวของ {prepared.length} ฮีโร่ สกิลที่ slot ตรงกันจะถูกอัปเดต สกิลที่เกมไม่ส่งมาแล้วจะไม่ถูกลบ ยืนยันหรือไม่?
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirming(false)} className={`${btn} border border-border bg-bg-surface hover:border-text-faint`}>
                  ยกเลิก
                </button>
                <button type="button" disabled={busy} onClick={() => void runImport()} className={`${btn} bg-accent text-accent-fg hover:brightness-110`}>
                  {busy ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
