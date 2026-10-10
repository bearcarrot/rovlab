import { SHARE_PARAM } from "./linkCodec";

// Browser-side helpers for share links: build the URL, then share (mobile sheet) or copy (desktop).
// Add new kinds (Community Item Build, ...) by passing their own path + code to buildShareUrl.

/** `code` is already URL-safe ([A-Za-z0-9-._~]) so it is not escaped; `extra` values are. */
export function buildShareUrl(path: string, code: string, extra: Record<string, string | undefined> = {}): string {
  const query = [`${SHARE_PARAM}=${code}`];
  for (const [key, value] of Object.entries(extra)) {
    const v = value?.trim();
    if (v) query.push(`${key}=${encodeURIComponent(v)}`);
  }
  return `${window.location.origin}${path}?${query.join("&")}`;
}

export type LinkShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Native share sheet only on touch devices; desktop browsers just copy (a link is expected to land in the clipboard). */
export function canNativeShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the legacy path (insecure context / permission denied)
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Must be called straight from the click handler so iOS keeps the user gesture for navigator.share. */
export async function shareOrCopyLink(url: string, title: string): Promise<LinkShareOutcome> {
  if (canNativeShare()) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // share failed for another reason: fall back to copying
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
