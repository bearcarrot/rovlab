import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserX,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/layout/Skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useToast } from "@/components/ui/toast";
import { CommentComposer } from "./CommentComposer";
import { MentionText } from "./MentionText";
import {
  adminSetFlags,
  blockUser,
  communityError,
  deleteComment,
  editComment,
  listComments,
  postComment,
  reportComment,
  setEmoji,
  setReaction,
} from "@/services/community";
import { EMOJIS, REPORT_REASONS, type CommentRow, type EmojiKey, type ReportReason } from "@/types/community";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";

type Panel = "reply" | "edit" | "report" | "share" | null;

interface Props {
  comment: CommentRow;
  heroSlug: string;
  isAdmin: boolean;
  // moderator or above: may pin/hide comments (the database enforces this; delete stays admin-only)
  isModerator?: boolean;
  canPost: boolean; // logged in AND email verified
  isReply?: boolean;
  highlightId?: string | null;
  defaultOpenReplies?: boolean;
  // replies (one level) post through the root comment so the thread reloads in one place
  onSubmitReply?: (targetId: string, body: string) => Promise<void>;
  onGone?: (id: string) => void;
}

export function CommentItem({
  comment,
  heroSlug,
  isAdmin,
  isModerator = false,
  canPost,
  isReply = false,
  highlightId,
  defaultOpenReplies = false,
  onSubmitReply,
  onGone,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [c, setC] = useState(comment);
  const [panel, setPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replies, setReplies] = useState<CommentRow[]>([]);
  const [showReplies, setShowReplies] = useState(defaultOpenReplies);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [gone, setGone] = useState(false);
  const [reason, setReason] = useState<ReportReason>("abuse");
  const [detail, setDetail] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const mine = user?.id === c.userId;
  const name = c.authorName?.trim() || "ผู้เล่นนิรนาม";
  const canModerate = isAdmin || isModerator;

  useEffect(() => {
    setC(comment);
  }, [comment]);

  useEffect(() => {
    if (highlightId === c.id) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, c.id]);

  async function loadReplies() {
    setLoadingReplies(true);
    try {
      setReplies(await listComments({ heroSlug, parentId: c.id, sort: "new", limit: 100 }));
    } catch {
      toast.error("โหลดการตอบกลับไม่สำเร็จ");
    } finally {
      setLoadingReplies(false);
    }
  }

  useEffect(() => {
    if (!isReply && showReplies && c.replyCount > 0) void loadReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplies, user?.id]);

  async function submitReply(targetId: string, body: string) {
    if (!user) throw new Error("login");
    await postComment({ userId: user.id, heroSlug, body, parentId: targetId });
    setC((p) => ({ ...p, replyCount: p.replyCount + 1 }));
    setShowReplies(true);
    await loadReplies();
  }
  const sendReply = isReply ? onSubmitReply : submitReply;

  function requireLogin(): boolean {
    if (user) return true;
    navigate("/login");
    return false;
  }

  async function react(v: 1 | -1) {
    if (!requireLogin() || !user) return;
    const prev = c;
    const next = c.myValue === v ? null : v;
    setC({
      ...c,
      myValue: next,
      likeCount: c.likeCount - (c.myValue === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      dislikeCount: c.dislikeCount - (c.myValue === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
    });
    try {
      await setReaction(c.id, user.id, next);
    } catch (e) {
      setC(prev);
      toast.error(communityError(e, "ทำรายการไม่สำเร็จ"));
    }
  }

  async function toggleEmoji(key: EmojiKey) {
    if (!requireLogin() || !user) return;
    const prev = c;
    const on = !c.myEmojis.includes(key);
    setC({
      ...c,
      myEmojis: on ? [...c.myEmojis, key] : c.myEmojis.filter((k) => k !== key),
      emojiCounts: { ...c.emojiCounts, [key]: Math.max(0, (c.emojiCounts[key] ?? 0) + (on ? 1 : -1)) },
    });
    try {
      await setEmoji(c.id, user.id, key, on);
    } catch (e) {
      setC(prev);
      toast.error(communityError(e, "ทำรายการไม่สำเร็จ"));
    }
  }

  async function saveEdit(body: string) {
    await editComment(c.id, body);
    setC({ ...c, body, editedAt: new Date().toISOString() });
    setPanel(null);
    toast.success("บันทึกการแก้ไขแล้ว");
  }

  async function remove() {
    const warn = !isReply && c.replyCount > 0 ? "ลบความคิดเห็นนี้? การตอบกลับทั้งหมดจะถูกลบไปด้วย" : "ลบความคิดเห็นนี้?";
    if (!window.confirm(warn)) return;
    try {
      await deleteComment(c.id);
      setGone(true);
      onGone?.(c.id);
      toast.success("ลบความคิดเห็นแล้ว");
    } catch (e) {
      toast.error(communityError(e, "ลบไม่สำเร็จ"));
    }
  }

  async function block() {
    if (!user) return;
    if (!window.confirm(`บล็อก ${name}? คุณจะไม่เห็นความคิดเห็นของผู้ใช้นี้อีก`)) return;
    try {
      await blockUser(user.id, c.userId);
      setGone(true);
      onGone?.(c.id);
      toast.success("บล็อกผู้ใช้แล้ว");
    } catch (e) {
      toast.error(communityError(e, "บล็อกไม่สำเร็จ"));
    }
  }

  async function submitReport() {
    if (!user) return;
    try {
      await reportComment(c.id, user.id, reason, detail);
      setPanel(null);
      setMenuOpen(false);
      setDetail("");
      toast.success("ขอบคุณที่รายงาน ทีมงานจะตรวจสอบ");
    } catch (e) {
      toast.error(communityError(e, "รายงานไม่สำเร็จ"));
    }
  }

  async function adminToggle(flags: { pinned?: boolean; hidden?: boolean }) {
    try {
      await adminSetFlags(c.id, flags);
      setC({ ...c, ...flags });
    } catch (e) {
      toast.error(communityError(e, "ทำรายการไม่สำเร็จ"));
    }
  }

  const shareUrl = `${window.location.origin}/heroes/${heroSlug}?c=${c.id}`;
  const shareText = `ความคิดเห็นของ ${name} บน RoV LAB`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  if (gone) return null;

  const actionBtn = "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-muted hover:text-text";

  return (
    <div ref={ref} id={`comment-${c.id}`} className={cn("flex gap-2.5", highlightId === c.id && "-m-2 rounded-lg bg-accent/10 p-2")}>
      <Link to={`/players/${c.userId}`} className="shrink-0" aria-label={`ดูโปรไฟล์ ${name}`}>
        <UserAvatar name={name} url={c.avatarUrl} className={isReply ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"} />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="flex min-w-0 items-center gap-1">
            <Link to={`/players/${c.userId}`} className="min-w-0 truncate font-display text-sm font-medium hover:text-accent">
              {name}
              {mine && <span className="ml-1.5 text-[11px] font-normal text-accent">(คุณ)</span>}
            </Link>
            <VerifiedBadge category={c.verifiedCategory} />
          </span>
          <span className="text-text-faint">@{c.handle}</span>
          {c.isAdmin && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">แอดมิน</span>}
          {c.pinned && (
            <span className="flex items-center gap-0.5 text-accent">
              <Pin className="h-3 w-3" /> ปักหมุด
            </span>
          )}
          {c.hidden && <span className="text-loss">ซ่อนอยู่ (ถูกรายงาน)</span>}
          <span className="text-text-faint">{timeAgo(c.createdAt)}</span>
          {c.editedAt && <span className="text-text-faint">(แก้ไขแล้ว)</span>}
        </div>

        {panel === "edit" ? (
          <CommentComposer initialValue={c.body} submitLabel="บันทึก" autoFocus onSubmit={saveEdit} onCancel={() => setPanel(null)} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
            {isReply && c.replyToHandle && !c.body.includes(`@${c.replyToHandle}`) && (
              <Link to={`/u/${c.replyToHandle}`} className="mr-1 text-text-faint hover:text-accent">
                ↪ @{c.replyToHandle}
              </Link>
            )}
            <MentionText text={c.body} />
          </p>
        )}

        {panel !== "edit" && (
          <div className="-ml-1.5 flex flex-wrap items-center gap-0.5">
            <button onClick={() => react(1)} aria-pressed={c.myValue === 1} aria-label="ถูกใจ" className={cn(actionBtn, c.myValue === 1 && "text-win")}>
              <ThumbsUp className="h-3.5 w-3.5" fill={c.myValue === 1 ? "currentColor" : "none"} /> {c.likeCount}
            </button>
            <button onClick={() => react(-1)} aria-pressed={c.myValue === -1} aria-label="ไม่ถูกใจ" className={cn(actionBtn, c.myValue === -1 && "text-loss")}>
              <ThumbsDown className="h-3.5 w-3.5" fill={c.myValue === -1 ? "currentColor" : "none"} /> {c.dislikeCount}
            </button>
            {EMOJIS.map((e) => {
              const on = c.myEmojis.includes(e.key);
              const n = c.emojiCounts[e.key] ?? 0;
              return (
                <button
                  key={e.key}
                  onClick={() => toggleEmoji(e.key)}
                  aria-label={e.label}
                  aria-pressed={on}
                  className={cn("flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs", on ? "border-accent bg-accent/10" : "border-transparent hover:border-border")}
                >
                  <span>{e.icon}</span>
                  {n > 0 && <span className="text-text-muted">{n}</span>}
                </button>
              );
            })}
            <button
              onClick={() => {
                if (!requireLogin()) return;
                if (!canPost) {
                  toast.info("ยืนยันอีเมลก่อนจึงจะตอบกลับได้");
                  return;
                }
                setPanel(panel === "reply" ? null : "reply");
              }}
              className={actionBtn}
            >
              <MessageCircle className="h-3.5 w-3.5" /> ตอบกลับ
            </button>
            <button onClick={() => setPanel(panel === "share" ? null : "share")} className={actionBtn} aria-label="แชร์">
              <Share2 className="h-3.5 w-3.5" />
            </button>
            {user && (
              <button onClick={() => setMenuOpen((o) => !o)} className={actionBtn} aria-label="เมนูเพิ่มเติม">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {menuOpen && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-bg-raised px-2.5 py-1.5 text-xs">
            {mine ? (
              <>
                <button onClick={() => { setPanel("edit"); setMenuOpen(false); }} className="flex items-center gap-1 text-text-muted hover:text-text">
                  <Pencil className="h-3 w-3" /> แก้ไข
                </button>
                <button onClick={remove} className="flex items-center gap-1 text-loss">
                  <Trash2 className="h-3 w-3" /> ลบ
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setPanel("report")} className="flex items-center gap-1 text-text-muted hover:text-text">
                  <Flag className="h-3 w-3" /> รายงาน
                </button>
                <button onClick={block} className="flex items-center gap-1 text-text-muted hover:text-text">
                  <UserX className="h-3 w-3" /> บล็อกผู้ใช้
                </button>
              </>
            )}
            {canModerate && (
              <>
                {!isReply && (
                  <button onClick={() => adminToggle({ pinned: !c.pinned })} className="flex items-center gap-1 text-accent">
                    <Pin className="h-3 w-3" /> {c.pinned ? "เลิกปักหมุด" : "ปักหมุด"}
                  </button>
                )}
                <button onClick={() => adminToggle({ hidden: !c.hidden })} className="flex items-center gap-1 text-accent">
                  <EyeOff className="h-3 w-3" /> {c.hidden ? "เลิกซ่อน" : "ซ่อน"}
                </button>
              </>
            )}
            {isAdmin && !mine && (
              <button onClick={remove} className="flex items-center gap-1 text-loss">
                <Trash2 className="h-3 w-3" /> ลบ (แอดมิน)
              </button>
            )}
          </div>
        )}

        {panel === "report" && (
          <div className="space-y-2 rounded-lg border border-border bg-bg-surface p-2.5 text-sm">
            <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm">
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <input value={detail} maxLength={500} onChange={(e) => setDetail(e.target.value)} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none placeholder:text-text-faint" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPanel(null)} className="rounded-md border border-border px-3 py-1 text-xs text-text-muted">ยกเลิก</button>
              <button onClick={submitReport} className="rounded-md bg-loss px-3 py-1 text-xs font-medium text-white">ส่งรายงาน</button>
            </div>
          </div>
        )}

        {panel === "share" && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-bg-raised px-2.5 py-1.5 text-xs">
            <button onClick={copyLink} className="text-text-muted hover:text-text">คัดลอกลิงก์</button>
            <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text">LINE</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text">Facebook</a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text">X</a>
            {canNativeShare && (
              <button onClick={() => void navigator.share({ title: shareText, url: shareUrl }).catch(() => {})} className="text-text-muted hover:text-text">แชร์ผ่านแอปอื่น…</button>
            )}
          </div>
        )}

        {panel === "reply" && sendReply && (
          <CommentComposer
            autoFocus
            placeholder={`ตอบกลับ ${name}`}
            initialValue={isReply ? `@${c.handle} ` : ""}
            submitLabel="ตอบกลับ"
            onSubmit={async (body) => {
              await sendReply(c.id, body);
              setPanel(null);
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {!isReply && c.replyCount > 0 && (
          <button onClick={() => setShowReplies((s) => !s)} className="flex items-center gap-1 text-xs font-medium text-accent">
            {showReplies ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showReplies ? "ซ่อนการตอบกลับ" : `ดูการตอบกลับ ${c.replyCount} รายการ`}
          </button>
        )}
        {!isReply && showReplies && (
          <div className="space-y-3 border-l border-border pl-3">
            {loadingReplies && replies.length === 0 && <Skeleton className="h-10" />}
            {replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                heroSlug={heroSlug}
                isAdmin={isAdmin}
                isModerator={isModerator}
                canPost={canPost}
                isReply
                highlightId={highlightId}
                onSubmitReply={submitReply}
                onGone={(id) => setReplies((rs) => rs.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
