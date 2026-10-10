import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Coach Ai answer feedback. Users go through submit_coach_feedback (own rows only, validated + rate-limited);
// the admin calls are SECURITY DEFINER RPCs that check is_admin() on the server (non-admins get FORBIDDEN).

export type FeedbackRating = "like" | "dislike";
export type FeedbackStatus = "new" | "reviewed" | "fixed" | "dismissed";

export const MIN_COMMENT = 3;
export const MAX_COMMENT = 500;

export interface SubmitFeedbackInput {
  rating: FeedbackRating;
  /** คำถามที่ผู้ใช้กด (label ของ Quick Chat หรือ prompt) */
  question: string;
  answer: string;
  /** ใช้เมื่อ rating = dislike: ผิดตรงไหน */
  comment?: string;
  /** ข้อมูลที่ส่งให้ AI ตอนถาม (เก็บเฉพาะ dislike เพื่อให้แอดมินแยกได้ว่า AI มั่ว หรือข้อมูลของเราผิด) */
  context?: unknown;
}

// ตัดให้เท่ากับที่ edge function ai-coach ตัดก่อนส่งให้โมเดล (JSON.stringify(...).slice(0, 8000))
function snapshot(context: unknown): string | null {
  if (context === undefined || context === null) return null;
  try {
    return JSON.stringify(context).slice(0, 8000);
  } catch {
    return null;
  }
}

export async function submitCoachFeedback(input: SubmitFeedbackInput): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("submit_coach_feedback", {
    p_rating: input.rating,
    p_question: input.question.slice(0, 500),
    p_answer: input.answer.slice(0, 8000),
    p_comment: input.rating === "dislike" ? (input.comment ?? "").trim().slice(0, MAX_COMMENT) : null,
    p_page: (window.location.pathname + window.location.search).slice(0, 300),
    p_context: input.rating === "dislike" ? snapshot(input.context) : null,
  });
  if (error) throw new Error(error.message || "ส่งรีวิวไม่สำเร็จ");
}

// ---------------- admin ----------------

export interface FeedbackCounts {
  likes: number;
  dislikes: number;
  newReports: number;
}

export interface FeedbackRow {
  id: string;
  createdAt: string;
  rating: FeedbackRating;
  question: string;
  answer: string;
  comment: string | null;
  page: string | null;
  context: string | null;
  status: FeedbackStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  userId: string;
  displayName: string | null;
  handle: string | null;
}

export interface FeedbackPage {
  rows: FeedbackRow[];
  total: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getFeedbackCounts(): Promise<FeedbackCounts> {
  const { data, error } = await supabase.rpc("admin_coach_feedback_counts");
  if (error) throw new Error(error.message || "โหลดข้อมูลไม่สำเร็จ");
  return { likes: num(data?.likes), dislikes: num(data?.dislikes), newReports: num(data?.new_reports) };
}

export async function listFeedback(opts: {
  status: FeedbackStatus | "all";
  rating: FeedbackRating | "all";
  offset: number;
  limit: number;
}): Promise<FeedbackPage> {
  const { data, error } = await supabase.rpc("admin_list_coach_feedback", {
    p_status: opts.status,
    p_rating: opts.rating,
    p_limit: opts.limit,
    p_offset: opts.offset,
  });
  if (error) throw new Error(error.message || "โหลดรายการไม่สำเร็จ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map(
    (r): FeedbackRow => ({
      id: r.id,
      createdAt: r.created_at,
      rating: r.rating,
      question: r.question,
      answer: r.answer,
      comment: r.comment ?? null,
      page: r.page ?? null,
      context: r.context ?? null,
      status: r.status,
      adminNote: r.admin_note ?? null,
      reviewedAt: r.reviewed_at ?? null,
      userId: r.user_id,
      displayName: r.display_name ?? null,
      handle: r.handle ?? null,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = num((data as any[] | null)?.[0]?.total_count);
  return { rows, total };
}

export async function updateFeedback(id: string, status: FeedbackStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc("admin_update_coach_feedback", {
    p_id: id,
    p_status: status,
    p_note: note.trim() || null,
  });
  if (error) throw new Error(error.message || "บันทึกไม่สำเร็จ");
}
