import { uuidToShortId } from "./shareId";

// Browser-side helpers for share links.
// Pretty links point at a Community row by its DB id (shortened to 22 chars): /draft/<id>, /tier-list/<id>.
// A future kind (Community Item Build) only needs its own path + the Community row id.

export type ShareLinkPath = "/draft" | "/tier-list";

export function buildShareUrl(path: ShareLinkPath, communityId: string): string {
  return `${window.location.origin}${path}/${uuidToShortId(communityId)}`;
}

/** Official Tier List link: the current filters (nothing is stored in the DB). Read back by pages/TierList.tsx. */
export function buildOfficialTierUrl(f: {
  rank: string;
  role: string | null;
  lane: string | null;
  tier: string | null;
}): string {
  const q = ["view=official", `rank=${encodeURIComponent(f.rank)}`];
  if (f.role) q.push(`role=${encodeURIComponent(f.role)}`);
  if (f.lane) q.push(`lane=${encodeURIComponent(f.lane)}`);
  if (f.tier) q.push(`tier=${encodeURIComponent(f.tier)}`);
  return `${window.location.origin}/tier-list?${q.join("&")}`;
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

export async function shareOrCopyLink(url: string, title: string): Promise<LinkShareOutcome> {
  if (canNativeShare()) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // share failed for another reason (e.g. the click's user gesture expired): fall back to copying
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
