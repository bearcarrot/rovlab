import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { isSupabaseConfigured } from "@/lib/supabase";
import { addHeroComment, COMMENT_MAX_LENGTH, deleteHeroComment, listHeroComments } from "@/services/comments";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!url && url.startsWith("https://") && !failed;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-raised font-display text-xs text-text-faint">
      {showImg ? (
        <img
          src={url!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{(Array.from(name)[0] ?? "?").toUpperCase()}</span>
      )}
    </div>
  );
}

export function HeroComments({ heroSlug }: { heroSlug: string }) {
  const { user } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const listQ = useAsync(() => listHeroComments(heroSlug), [heroSlug, reloadKey]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="ยังไม่ได้เชื่อม Supabase"
        description="ระบบความคิดเห็นต้องใช้ฐานข้อมูล ตั้งค่า .env เพื่อเปิดใช้งาน"
      />
    );
  }

  async function submit() {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      await addHeroComment(heroSlug, user.id, text);
      setText("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งความคิดเห็นไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบความคิดเห็นนี้?")) return;
    setDeletingId(id);
    setError("");
    try {
      await deleteHeroComment(id);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบความคิดเห็นไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {user ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            rows={3}
            placeholder="แชร์เคล็ดลับหรือประสบการณ์การเล่นฮีโร่ตัวนี้..."
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-faint">{text.length}/{COMMENT_MAX_LENGTH}</span>
            <button
              onClick={submit}
              disabled={busy || text.trim().length === 0}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-50"
            >
              {busy ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> เพื่อแสดงความคิดเห็น
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {listQ.status === "loading" && <Skeleton className="h-24" />}
      {listQ.status === "error" && <ErrorState message={listQ.message} onRetry={listQ.refetch} />}
      {listQ.status === "success" && listQ.data.length === 0 && (
        <EmptyState icon={MessageCircle} title="ยังไม่มีความคิดเห็น" description="เป็นคนแรกที่แชร์เคล็ดลับของฮีโร่ตัวนี้" />
      )}
      {listQ.status === "success" && listQ.data.length > 0 && (
        <ul className="space-y-3">
          {listQ.data.map((c) => {
            const mine = user?.id === c.userId;
            return (
              <li key={c.id} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
                <Avatar name={c.authorName} url={c.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-sm font-medium">
                      {c.authorName}
                      {mine && <span className="ml-1.5 text-[11px] font-normal text-accent">(คุณ)</span>}
                    </p>
                    <span className="shrink-0 text-[11px] text-text-faint">{formatWhen(c.createdAt)}</span>
                    {mine && (
                      <button
                        onClick={() => remove(c.id)}
                        disabled={deletingId === c.id}
                        aria-label="ลบความคิดเห็น"
                        className="ml-auto shrink-0 text-text-faint hover:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-muted">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
