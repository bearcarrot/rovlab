/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadCatalogImage } from "@/lib/r2Upload";
import { useToast } from "@/components/ui/toast";
import { explainDbError } from "@/lib/catalogAdmin";
import { Thumb } from "./ImageSelect";

const db: any = supabase;

export type TreeIcon = { id: string; name: string; name_th: string; icon_url: string | null };

// อัปโหลดไอคอนของสายพลังแฝง (แทนเพชรสำรอง) เก็บใน Cloudflare R2 ที่ hero-icons/enchantment_trees/ ผ่าน /api/upload แล้วบันทึกลง enchantment_trees.icon_url
export function TreeIconEditor({ trees, onSaved }: { trees: TreeIcon[]; onSaved: (id: string, url: string | null) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (t: TreeIcon, url: string | null) => {
    const { error } = await db.from("enchantment_trees").update({ icon_url: url }).eq("id", t.id);
    if (error) throw error;
    onSaved(t.id, url);
  };

  const upload = async (t: TreeIcon, file: File) => {
    setBusy(t.id);
    try {
      await save(t, await uploadCatalogImage(file, "enchantment_trees"));
      toast.success(`บันทึกไอคอน ${t.name_th || t.name} แล้ว`);
    } catch (e) {
      toast.error(`บันทึกไอคอนไม่สำเร็จ: ${explainDbError(e as any)}`);
    } finally {
      setBusy(null);
    }
  };

  const clear = async (t: TreeIcon) => {
    setBusy(t.id);
    try {
      await save(t, null);
    } catch (e) {
      toast.error(`ลบไอคอนไม่สำเร็จ: ${explainDbError(e as any)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="rounded-xl border border-border bg-bg-surface p-3">
      <summary className="cursor-pointer text-sm font-medium">ไอคอนสายพลังแฝง ({trees.filter((t) => t.icon_url).length}/{trees.length})</summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {trees.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-raised p-2">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center">
              {t.icon_url ? <Thumb src={t.icon_url} label={t.name} bare className="h-full w-full" /> : <span className="text-[10px] text-text-faint">ไม่มีรูป</span>}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{t.name_th || t.name}</span>
            {busy === t.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            ) : (
              <>
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-text-muted hover:border-accent hover:text-accent">
                  <Upload className="h-3.5 w-3.5" />
                  อัปโหลด
                  <input type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(t, f); }} />
                </label>
                {t.icon_url && (
                  <button type="button" aria-label="เอารูปออก" onClick={() => void clear(t)} className="h-9 w-9 rounded-lg border border-border text-text-faint hover:text-loss">
                    <X className="mx-auto h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-text-faint">แนะนำ PNG/WebP/SVG พื้นโปร่งใส ไม่มีรูปจะใช้เพชรสีสำรอง</p>
    </details>
  );
}
