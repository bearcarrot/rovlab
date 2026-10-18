// Storage cleanup ordering (spec section 8). Pure, dependency-injected, no runtime imports.
// Rules: never remove the old image before the record is safely saved; remove the new upload if the save fails;
// a failed cleanup leaves an orphan file at worst - it never fails the save/delete and never touches the record.
export type CleanupState = "none" | "ok" | "failed";
export type CleanupDeps = {
  isOwnUrl(url: string): boolean; // true only for objects in our announcements bucket
  countReferences(url: string, excludeId: string | null): Promise<number>; // other announcements still using this image
  removeImage(url: string): Promise<boolean>; // true when the object was removed
};

async function dropIfUnreferenced(url: string, excludeId: string | null, deps: CleanupDeps): Promise<CleanupState> {
  try {
    if (!deps.isOwnUrl(url)) return "none";
    if ((await deps.countReferences(url, excludeId)) > 0) return "none";
    return (await deps.removeImage(url)) ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

export async function saveWithImageCleanup(
  args: { oldUrl: string | null; newUrl: string | null; uploadedUrl: string | null; save: () => Promise<string> },
  deps: CleanupDeps,
): Promise<{ id: string; cleanup: CleanupState }> {
  let id: string;
  try {
    id = await args.save();
  } catch (e) {
    if (args.uploadedUrl !== null && deps.isOwnUrl(args.uploadedUrl)) {
      try { await deps.removeImage(args.uploadedUrl); } catch { /* an orphan is acceptable; the save error is what matters */ }
    }
    throw e;
  }
  if (args.oldUrl === null || args.oldUrl === args.newUrl) return { id, cleanup: "none" };
  return { id, cleanup: await dropIfUnreferenced(args.oldUrl, id, deps) };
}

export async function deleteWithImageCleanup(
  args: { remove: () => Promise<string | null> }, // deletes the row and returns its old media_url
  deps: CleanupDeps,
): Promise<{ cleanup: CleanupState }> {
  const url = await args.remove(); // if this throws, nothing was deleted and no cleanup is attempted
  if (url === null) return { cleanup: "none" };
  return { cleanup: await dropIfUnreferenced(url, null, deps) };
}
