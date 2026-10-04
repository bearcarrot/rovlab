import { useState } from "react";
import { updateHandle } from "@/services/profile";
import { communityError, HANDLE_RE } from "@/services/community";

export function HandleEditor({ userId, current, onSaved }: { userId: string; current: string; onSaved: (handle: string) => void }) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = HANDLE_RE.test(value);
  const dirty = value !== current;

  async function save() {
    if (!valid || !dirty || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await updateHandle(userId, value);
      onSaved(value);
      setMsg({ ok: true, text: "บันทึกชื่อผู้ใช้แล้ว" });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      const text =
        code === "23505"
          ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว"
          : code === "23514"
            ? "รูปแบบไม่ถูกต้อง"
            : communityError(e, "บันทึกไม่สำเร็จ");
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-border bg-bg px-3 text-sm focus-within:border-accent">
          <span className="text-text-faint">@</span>
          <input
            value={value}
            maxLength={20}
            onChange={(e) => setValue(e.target.value.trim())}
            className="w-full bg-transparent py-2 pl-1 outline-none"
            aria-label="ชื่อผู้ใช้"
          />
        </div>
        <button onClick={save} disabled={!valid || !dirty || busy} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
          {busy ? "..." : "บันทึก"}
        </button>
      </div>
      <p className={`text-[11px] ${value && !valid ? "text-loss" : "text-text-faint"}`}>
        3–20 ตัว ใช้ได้เฉพาะ A–Z, 0–9 และ _ (คนอื่นใช้ชื่อนี้เพื่อ @แท็กคุณ)
      </p>
      {msg && <p className={`text-xs ${msg.ok ? "text-win" : "text-loss"}`}>{msg.text}</p>}
    </div>
  );
}
