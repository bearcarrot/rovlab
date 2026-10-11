import { useState } from "react";
import { Modal } from "@/features/community/Modal";

// A share link points at the item's Community entry, so sharing a private/unsaved/changed item means
// saving it and publishing (or updating) it in Community first. This dialog makes that explicit.
export function PublishShareDialog({
  noun,
  initialName,
  fixedName,
  nameMax,
  updating,
  busy,
  onCancel,
  onConfirm,
}: {
  noun: string; // "Draft" | "Tier List"
  initialName?: string;
  /** Show the name read-only (Tier List: the name is edited in the editor, not here). */
  fixedName?: string;
  nameMax?: number;
  /** Already public: only pushes the current version. */
  updating: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const finalName = (fixedName ?? name).trim();
  return (
    <Modal title={updating ? `อัปเดต ${noun} ที่แชร์` : `เผยแพร่เพื่อแชร์ลิงก์`} onClose={busy ? () => {} : onCancel}>
      <div className="space-y-3 text-sm">
        {fixedName === undefined ? (
          <label className="block">
            <span className="mb-1 block text-xs text-text-faint">ชื่อ {noun}</span>
            <input
              value={name}
              maxLength={nameMax}
              onChange={(e) => setName(e.target.value)}
              placeholder={`ตั้งชื่อ ${noun} ของคุณ`}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent/60"
            />
          </label>
        ) : (
          <p className="text-text-muted">
            ชื่อ: <span className="font-medium text-text">{fixedName}</span>
          </p>
        )}
        <p className="text-xs text-text-muted">
          {updating
            ? `${noun} นี้เผยแพร่ใน Community อยู่แล้ว จะอัปเดตเป็นเวอร์ชันปัจจุบัน (ไลก์เดิมยังอยู่) แล้วคัดลอกลิงก์`
            : `ลิงก์แชร์ใช้ ${noun} ที่เผยแพร่ใน Community: ${noun} จะถูกบันทึกในบัญชีของคุณ และทุกคนเห็นได้ในหน้า Community ต้องการเอาออกภายหลัง ตั้งเป็น Private (ลิงก์จะเปิดไม่ได้)`}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-text-muted hover:text-text disabled:opacity-60">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(finalName)}
            disabled={busy || finalName === ""}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg disabled:opacity-60"
          >
            {busy ? "กำลังดำเนินการ…" : updating ? "อัปเดตและแชร์" : "เผยแพร่และแชร์"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
