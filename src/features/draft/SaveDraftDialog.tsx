import { useState } from "react";
import { Modal } from "@/features/community/Modal";
import { DRAFT_DESC_MAX, DRAFT_NAME_MAX, type Visibility } from "@/services/draftSeries";

export interface SaveDraftValues {
  name: string;
  description: string;
  visibility: Visibility;
}

export function SaveDraftDialog({
  initial,
  editing,
  busy,
  onCancel,
  onSave,
}: {
  initial: SaveDraftValues;
  editing: boolean; // true when the editor holds an already saved draft
  busy: boolean;
  onCancel: () => void;
  onSave: (v: SaveDraftValues, asCopy: boolean) => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");

  function submit(asCopy: boolean) {
    if (v.name.trim() === "") {
      setError(v.visibility === "public" ? "กรุณาตั้งชื่อ Draft ก่อนเผยแพร่" : "กรุณาตั้งชื่อ Draft");
      return;
    }
    onSave(v, asCopy);
  }

  return (
    <Modal title="บันทึก Draft" onClose={busy ? () => {} : onCancel}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-text-faint">ชื่อ Draft</span>
          <input
            value={v.name}
            maxLength={DRAFT_NAME_MAX}
            onChange={(e) => {
              setV({ ...v, name: e.target.value });
              setError("");
            }}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-faint">รายละเอียด (ไม่บังคับ)</span>
          <textarea
            value={v.description}
            maxLength={DRAFT_DESC_MAX}
            rows={3}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </label>
        <fieldset>
          <legend className="mb-1 text-xs text-text-faint">การมองเห็น</legend>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="vis" checked={v.visibility === "private"} onChange={() => setV({ ...v, visibility: "private" })} className="mt-1" />
              <span>Private <span className="text-xs text-text-faint">— เห็นเฉพาะคุณ</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="vis" checked={v.visibility === "public"} onChange={() => setV({ ...v, visibility: "public" })} className="mt-1" />
              <span>Public <span className="text-xs text-text-faint">— แสดงใน Community Draft (เป็นสำเนา ณ เวลาที่เผยแพร่)</span></span>
            </label>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-xs text-loss">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text">
            ยกเลิก
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={() => submit(true)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg-raised">
              บันทึกเป็นสำเนาใหม่
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => submit(false)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
