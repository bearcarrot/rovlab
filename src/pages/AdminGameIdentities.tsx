import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Search, UserX } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import {
  adminReleaseGameIdentity,
  adminSearchGameIdentities,
  type AdminGameIdentity,
} from "@/services/adminGameIdentity";

function whenText(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

// แอดมิน: ค้นหาไอดีเกมที่ผูกไว้ และปลดไอดีที่ถูกบัญชีอื่นสวมรอย
export function AdminGameIdentities() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminGameIdentity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seq = useRef(0);

  const search = useCallback(async (q: string) => {
    const id = ++seq.current; // ignore out-of-order responses
    setError(null);
    try {
      const r = await adminSearchGameIdentities(q);
      if (id === seq.current) setRows(r);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void search("");
  }, [search]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setRows(null);
    void search(query);
  }

  async function release(r: AdminGameIdentity) {
    const who = r.displayName || (r.handle ? `@${r.handle}` : r.userId);
    if (
      !window.confirm(
        `ปลด OpenID ${r.playerId} (${r.ign}) ออกจากบัญชี ${who}?\nเจ้าของบัญชีนี้จะหายชื่อในเกมจนกว่าจะผูกใหม่ และคนอื่นจะผูก OpenID นี้ได้`,
      )
    ) {
      return;
    }
    setBusyId(r.userId);
    try {
      const ok = await adminReleaseGameIdentity(r.playerId);
      if (ok) toast.success("ปลดไอดีแล้ว");
      else toast.error("ไม่พบรายการนี้ (อาจถูกปลดไปแล้ว)");
      await search(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ปลดไอดีไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-semibold">ไอดีเกมที่ผูกไว้</h1>
        <p className="text-xs text-text-faint">
          ใช้เมื่อมีคนแจ้งว่า OpenID ของตนถูกคนอื่นผูกสวมรอย การผูกไม่ได้พิสูจน์ว่าเป็นเจ้าของไอดี ควรตรวจสอบผู้แจ้งก่อนปลด
          ปลดแล้วเจ้าของตัวจริงจะผูกใหม่ได้ OpenID แสดงให้แอดมินเห็นเท่านั้น
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="OpenID, ชื่อในเกม, @handle หรือชื่อที่แสดง"
          autoComplete="off"
          maxLength={60}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60"
        />
        <button
          type="submit"
          aria-label="ค้นหา"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          <Search className="h-4 w-4" />
          ค้นหา
        </button>
      </form>

      {error && <ErrorState message={error} onRetry={() => void search(query)} />}
      {!error && rows === null && <Skeleton className="h-32" />}
      {!error && rows && rows.length === 0 && (
        <EmptyState icon={UserX} title="ไม่พบรายการ" description="ลองค้นด้วย OpenID หรือชื่ออื่น" />
      )}
      {!error && rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.userId} className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-display text-base font-semibold">{r.ign}</p>
                  <p className="select-all text-xs text-text-muted">OpenID {r.playerId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void release(r)}
                  disabled={busyId !== null}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-loss hover:bg-bg-raised disabled:opacity-50"
                >
                  {busyId === r.userId ? "กำลังปลด..." : "ปลดไอดี"}
                </button>
              </div>
              <p className="text-[11px] text-text-faint">
                บัญชี:{" "}
                <Link to={`/players/${r.userId}`} className="text-accent">
                  {r.displayName || "ผู้เล่น"}
                  {r.handle ? ` (@${r.handle})` : ""}
                </Link>
                {r.server ? ` · เซิร์ฟเวอร์ ${r.server}` : ""}
              </p>
              <p className="text-[11px] text-text-faint">
                ผูกเมื่อ {whenText(r.verifiedAt)} · อัปเดตชื่อล่าสุด {whenText(r.refreshedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length === 20 && (
        <p className="text-[11px] text-text-faint">แสดง 20 รายการล่าสุด หากไม่เจอให้ค้นแคบลง</p>
      )}
    </div>
  );
}
