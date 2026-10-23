import type { Visibility } from "@/services/draftSeries";
import type { MyTierList } from "@/services/userTierLists";
import { NAME_MAX, createDefault, loadCustom, type CustomTierList } from "./customTierList";
import { LANE_ALL, lanesCustomized, lanesHeroCount, lanesSig, parseLanes, tierSig, type TierLanes } from "./tierData";

// Glue between the local editor ("Tier List ของฉัน", localStorage) and the cloud lists (My / Community).
// The editor keeps autosaving locally; "บันทึก" copies it to the account. This record remembers which cloud
// list the editor was loaded from so a re-save updates that row (never a different one).

export interface CloudState {
  id: string | null;
  description: string;
  patch: string;
  visibility: Visibility;
  savedSig: string; // signature of the content at the last save/load, to detect unsaved changes
}

export const EMPTY_CLOUD: CloudState = { id: null, description: "", patch: "", visibility: "private", savedSig: "" };
export const CLOUD_KEY = "rovlab:tier:cloud";

/**
 * Covers every lane (not only the one open in the editor). A single "all" lane keeps the exact pre-lanes signature,
 * so a session that was saved before this change does not suddenly look "unsaved".
 */
export const sigOf = (l: { name: string; lanes: TierLanes }): string =>
  JSON.stringify([l.name.trim(), l.lanes.length === 1 && l.lanes[0].id === LANE_ALL ? tierSig(l.lanes[0].rows) : lanesSig(l.lanes)]);

/** Never-saved editor content worth warning about: heroes placed on any lane, extra lanes, or rows changed from the default five. */
export const hasLocalWork = (lanes: TierLanes): boolean => lanesHeroCount(lanes) > 0 || lanesCustomized(lanes);

export function readCloud(): CloudState {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLOUD_KEY) ?? "null") as Partial<CloudState> | null;
    if (!v || typeof v !== "object") return EMPTY_CLOUD;
    return {
      id: typeof v.id === "string" ? v.id : null,
      description: typeof v.description === "string" ? v.description.slice(0, 500) : "",
      patch: typeof v.patch === "string" ? v.patch.slice(0, 20) : "",
      visibility: v.visibility === "public" ? "public" : "private",
      savedSig: typeof v.savedSig === "string" ? v.savedSig : "",
    };
  } catch {
    return EMPTY_CLOUD;
  }
}

export function writeCloud(c: CloudState): void {
  try {
    sessionStorage.setItem(CLOUD_KEY, JSON.stringify(c));
  } catch {
    // storage unavailable: association is only kept in memory
  }
}

/** True when the editor holds heroes that exist nowhere else (not saved, or changed since the last save). */
export function editorHasUnsavedWork(): boolean {
  const l = loadCustom();
  if (!l) return false;
  const cloud = readCloud();
  return cloud.id ? sigOf(l) !== cloud.savedSig : hasLocalWork(l.lanes);
}

export const toCustom = (src: { name: string; patch: string; lanes: TierLanes }): CustomTierList => ({
  ...createDefault(src.patch),
  name: src.name.slice(0, NAME_MAX),
  patch: src.patch,
  lanes: parseLanes({ v: 3, lanes: src.lanes }),
});

export const fromMyList = (l: MyTierList): { list: CustomTierList; cloud: CloudState } => {
  const list = toCustom({ name: l.name, patch: l.patch, lanes: l.lanes });
  return {
    list,
    cloud: { id: l.id, description: l.description, patch: l.patch, visibility: l.visibility, savedSig: sigOf(list) },
  };
};
