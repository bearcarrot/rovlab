export type EmojiKey = "fire" | "laugh" | "clap";

export const EMOJIS: { key: EmojiKey; icon: string; label: string }[] = [
  { key: "fire", icon: "🔥", label: "ไฟลุก" },
  { key: "laugh", icon: "😂", label: "ขำ" },
  { key: "clap", icon: "👏", label: "ปรบมือ" },
];

export type ReportReason = "spam" | "abuse" | "hate" | "sexual" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "สแปม / โฆษณา" },
  { value: "abuse", label: "คำหยาบ / ด่าทอ" },
  { value: "hate", label: "เหยียด / ยุยงเกลียดชัง" },
  { value: "sexual", label: "เนื้อหาไม่เหมาะสมทางเพศ" },
  { value: "other", label: "อื่น ๆ" },
];

export type CommentSort = "top" | "new";

export interface CommentRow {
  id: string;
  parentId: string | null;
  replyToHandle: string | null;
  userId: string;
  handle: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  dislikeCount: number;
  replyCount: number;
  emojiCounts: Partial<Record<EmojiKey, number>>;
  myValue: 1 | -1 | null;
  myEmojis: EmojiKey[];
}

export type NotificationType = "mention" | "reply" | "like" | "follow";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string;
  actorHandle: string;
  commentId: string | null;
  heroSlug: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface PublicProfile {
  id: string;
  handle: string;
  avatarUrl: string | null;
}

export interface FeedItem {
  id: string;
  heroSlug: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  userId: string;
  handle: string;
  avatarUrl: string | null;
}
