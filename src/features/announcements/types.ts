// Types only (no runtime code) so pure modules can `import type` from here under node --experimental-strip-types.
export type MediaType = "none" | "image" | "video" | "link";
export type Priority = "normal" | "important" | "urgent";
export type Status = "draft" | "published" | "archived";

export type MediaErrorCode =
  | "MEDIA_NOT_ALLOWED"
  | "MEDIA_URL_REQUIRED"
  | "MEDIA_URL_INVALID"
  | "VIDEO_UNSUPPORTED"
  | "LINK_URL_NOT_ALLOWED"
  | "LABEL_WITHOUT_LINK"
  | "LABEL_TOO_LONG";

export type Announcement = {
  id: string;
  title: string;
  content: string;
  media_type: MediaType;
  media_url: string | null;
  link_url: string | null;
  link_label: string | null;
  status: Status;
  priority: Priority;
  is_dismissible: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};
