import type { Visibility } from "@/services/draftSeries";
import type { MyTierList } from "@/services/userTierLists";
import { NAME_MAX, createDefault, loadCustom, type CustomTierList } from "./customTierList";
import { listSig, parseTierData, rowsCustomized, tierHeroCount, type TierData } from "./tierData";

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

// Includes the duplicates setting, so toggling it counts as an unsaved change. OFF keeps the pre-setting signature.
export const sigOf = (l: { name: string; tiers: TierData; allowDuplicates?: boolean }): string => listSig(l.name, l.tiers, l.allowDuplicates === true);

/** Never-saved editor content worth warning about: heroes placed, or rows changed from the default five. */
export const hasLocalWork = (tiers: TierData): boolean => tierHeroCount(tiers) > 0 || rowsCustomized(tiers);

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
  return cloud.id ? sigOf(l) !== cloud.savedSig : hasLocalWork(l.tiers);
}

export const toCustom = (src: { name: string; patch: string; data: TierData; allowDuplicates?: boolean }): CustomTierList => {
  const allowDuplicates = src.allowDuplicates === true;
  return {
    ...createDefault(src.patch),
    name: src.name.slice(0, NAME_MAX),
    patch: src.patch,
    tiers: parseTierData(src.data, allowDuplicates),
    allowDuplicates,
  };
};

export const fromMyList = (l: MyTierList): { list: CustomTierList; cloud: CloudState } => {
  const list = toCustom({ name: l.name, patch: l.patch, data: l.data, allowDuplicates: l.allowDuplicates });
  return {
    list,
    cloud: { id: l.id, description: l.description, patch: l.patch, visibility: l.visibility, savedSig: sigOf(list) },
  };
};
