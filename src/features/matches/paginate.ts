// Page arithmetic for the saved-matches list on the Matches page. The list is sliced in the browser from the matches that
// are already loaded (MATCH_LOAD_LIMIT); the analytics still receive the whole set, only the list below them is paged.
export const PAGE_SIZE = 20;

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Always a valid page: a deletion can empty the last page, and a refetch can shrink the list. */
export function clampPage(page: number, total: number, size = PAGE_SIZE): number {
  const p = Math.floor(page) || 1;
  return Math.min(Math.max(1, p), pageCount(total, size));
}

export function pageSlice<T>(list: readonly T[], page: number, size = PAGE_SIZE): T[] {
  const p = clampPage(page, list.length, size);
  return list.slice((p - 1) * size, p * size);
}
