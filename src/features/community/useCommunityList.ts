import { useCallback, useEffect, useRef, useState } from "react";

export const COMMUNITY_PAGE_SIZE = 20;

/**
 * Paged list for the Community tabs. `fetchPage(offset, limit)` is called with limit = PAGE + 1 so we
 * know whether another page exists without a count query. Changing `deps` (sort / search) restarts it.
 */
export function useCommunityList<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  deps: unknown[]
) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    const mine = ++seq.current;
    setStatus("loading");
    fetchRef
      .current(0, COMMUNITY_PAGE_SIZE + 1)
      .then((rows) => {
        if (mine !== seq.current) return;
        setItems(rows.slice(0, COMMUNITY_PAGE_SIZE));
        setHasMore(rows.length > COMMUNITY_PAGE_SIZE);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  /** Resolves true when more rows were appended; throws on failure so the caller can toast. */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const mine = seq.current;
    setLoadingMore(true);
    try {
      const rows = await fetchRef.current(items.length, COMMUNITY_PAGE_SIZE + 1);
      if (mine !== seq.current) return;
      setItems((cur) => [...cur, ...rows.slice(0, COMMUNITY_PAGE_SIZE)]);
      setHasMore(rows.length > COMMUNITY_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, loadingMore]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { items, setItems, status, error, hasMore, loadingMore, loadMore, retry };
}
