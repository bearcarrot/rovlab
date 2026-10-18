import type { MediaErrorCode, MediaType } from "./types";

// Mirrors public.announcement_https_url_ok / public.announcement_media_error (migration 20261016c_announcements.sql).
// Any change here must change the SQL and tests/announcements/media-vectors.json together.
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?";
const HOST = `${LABEL}(?:\\.${LABEL})+`; // >= 1 dot: rejects localhost / single-label hosts; ASCII/punycode only
const PATH_CHARS = "[A-Za-z0-9\\-._~:/?#\\[\\]@!$&()*+,;=%]"; // RFC 3986 characters minus quotes: no whitespace, <, >, ", ', \
const HTTPS_URL_RE = new RegExp(`^https://(${HOST})(?::[0-9]{1,5})?(?:[/?#]${PATH_CHARS}*)?$`);
const IPV4_LIKE_RE = /^[0-9.]+$/;
const MAX_URL_LEN = 2048;
const MAX_LABEL_CODE_POINTS = 40;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_WATCH_PATH_RE = /^\/watch\/?$/;
const QUERY_V_RE = /(?:^|&)v=([^&]*)/;
const DIRECT_VIDEO_RE = /\.(mp4|webm|ogv)$/i;
const OWN_BUCKET_PATH = "/storage/v1/object/public/announcements/";
const OWN_BUCKET_IMAGE_RE = /\.(jpg|jpeg|png|webp)$/i;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YT_NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"]);

export type ParsedVideo = { kind: "youtube" | "vimeo"; id: string } | { kind: "direct"; url: string };

function clean(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

function httpsUrlOk(u: string): boolean {
  if (u.length > MAX_URL_LEN) return false;
  const m = HTTPS_URL_RE.exec(u);
  if (!m) return false;
  return !IPV4_LIKE_RE.test(m[1]);
}

// Plain-regex splitting (no URL class, no decoding, no normalisation) so TS and SQL see exactly the same host/path/query.
// SQL mirror: lower(substring(u from '^https://([^/?#:]+)')), substring(u from '^https://[^/?#]+([^?#]*)'),
//             substring(u from '^https://[^/?#]+[^?#]*\\?([^#]*)').
function splitUrl(u: string): { host: string; path: string; query: string | null } {
  const m = /^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/.exec(u);
  const hostPort = m ? m[1] : "";
  return { host: hostPort.split(":")[0].toLowerCase(), path: m ? m[2] : "", query: m && m[3] !== undefined ? m[3] : null };
}

function pathBeforeQuery(u: string): string {
  return splitUrl(u).path;
}

export function isOwnBucketUrl(url: string): boolean {
  const u = clean(url);
  return u !== null && httpsUrlOk(u) && pathBeforeQuery(u).startsWith(OWN_BUCKET_PATH);
}

export function parseVideo(url: string): ParsedVideo | null {
  const u = clean(url);
  if (u === null || !httpsUrlOk(u)) return null;
  const { host, path, query } = splitUrl(u);
  if (YT_HOSTS.has(host)) {
    if (YT_WATCH_PATH_RE.test(path) && query !== null) {
      const v = QUERY_V_RE.exec(query);
      if (v !== null && YT_ID_RE.test(v[1])) return { kind: "youtube", id: v[1] };
    }
    const e = /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/.exec(path);
    if (e !== null) return { kind: "youtube", id: e[1] };
  } else if (YT_NOCOOKIE_HOSTS.has(host)) {
    const e = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(path);
    if (e !== null) return { kind: "youtube", id: e[1] };
  } else if (host === "youtu.be") {
    const e = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(path);
    if (e !== null) return { kind: "youtube", id: e[1] };
  } else if (VIMEO_HOSTS.has(host)) {
    const e = /^\/([0-9]{1,12})\/?$/.exec(path);
    if (e !== null) return { kind: "vimeo", id: e[1] };
  } else if (host === "player.vimeo.com") {
    const e = /^\/video\/([0-9]{1,12})\/?$/.exec(path);
    if (e !== null) return { kind: "vimeo", id: e[1] };
  }
  if (DIRECT_VIDEO_RE.test(path)) return { kind: "direct", url: u };
  return null;
}

export function embedUrl(v: { kind: "youtube" | "vimeo"; id: string }): string {
  return v.kind === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${v.id}?autoplay=1`;
}

export function mediaError(i: { mediaType: MediaType; mediaUrl: string | null; linkUrl: string | null; linkLabel: string | null }): MediaErrorCode | null {
  const t = i.mediaType;
  const mu = clean(i.mediaUrl);
  const lu = clean(i.linkUrl);
  const ll = clean(i.linkLabel);
  // 1. type-specific presence
  if (t === "none" && mu !== null) return "MEDIA_NOT_ALLOWED";
  if (t !== "none" && mu === null) return "MEDIA_URL_REQUIRED";
  // 2. URL validity (media_url, then link_url; link_url reuses MEDIA_URL_INVALID - the spec lists no separate code)
  if (mu !== null && !httpsUrlOk(mu)) return "MEDIA_URL_INVALID";
  if (lu !== null && !httpsUrlOk(lu)) return "MEDIA_URL_INVALID";
  if (t === "image" && mu !== null && isOwnBucketUrl(mu) && !OWN_BUCKET_IMAGE_RE.test(pathBeforeQuery(mu))) return "MEDIA_URL_INVALID";
  // 3. video support
  if (t === "video" && mu !== null && parseVideo(mu) === null) return "VIDEO_UNSUPPORTED";
  // 4. link_url rule
  if (t === "link" && lu !== null) return "LINK_URL_NOT_ALLOWED";
  // 5. label rules (too long wins over missing link)
  if (ll !== null && Array.from(ll).length > MAX_LABEL_CODE_POINTS) return "LABEL_TOO_LONG";
  if (ll !== null && lu === null && t !== "link") return "LABEL_WITHOUT_LINK";
  return null;
}
