import { useState } from "react";
import { Modal } from "@/features/community/Modal";
import { TIER_DESC_MAX, TIER_PATCH_MAX } from "@/services/userTierLists";
import type { Visibility } from "@/services/draftSeries";

export interface SaveTierListValues {
  description: string;
  patch: string;
  visibility: Visibility;
}

export function SaveTierListDialog({
  name,
  initial,
  editing,
  busy,
  onCancel,
  onSave,
}: {
  name: string; // comes from the editor's name field (edit it there)
  initial: SaveTierListValues;
  editing: boolean; // true when the editor holds an already saved list
  busy: boolean;
  onCancel: () => void;
  onSave: (v: SaveTierListValues, asCopy: boolean) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <Modal title="บันทึก Tier List" onClose={busy ? () => {} : onCancel}>
      <div className="space-y-3">
        <p className="text-sm">
          <span className="text-xs text-text-faint">ชื่อ: </span>
          <span className="font-medium">{name}</span>
          <span className="block text-xs text-text-faint">แก้ชื่อได้ที่ช่องชื่อ Tier List ในหน้าจัดอันดับ</span>
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-text-faint">Patch / Season (ไม่บังคับ)</span>
          <input
            value={v.patch}
            maxLength={TIER_PATCH_MAX}
            onChange={(e) => setV({ ...v, patch: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-faint">รายละเอียด (ไม่บังคับ)</span>
          <textarea
            value={v.description}
            maxLength={TIER_DESC_MAX}
            rows={3}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </label>
        <fieldset>
          <legend className="mb-1 text-xs text-text-faint">การมองเห็น</legend>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="tl-vis" checked={v.visibility === "private"} onChange={() => setV({ ...v, visibility: "private" })} className="mt-1" />
              <span>Private <span className="text-xs text-text-faint">— เห็นเฉพาะคุณ</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="tl-vis" checked={v.visibility === "public"} onChange={() => setV({ ...v, visibility: "public" })} className="mt-1" />
              <span>Public <span className="text-xs text-text-faint">— แสดงใน Community Tier List (เป็นสำเนา ณ เวลาที่เผยแพร่)</span></span>
            </label>
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text">
            ยกเลิก
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={() => onSave(v, true)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg-raised">
              บันทึกเป็นสำเนาใหม่
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => onSave(v, false)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
