import { useEffect, useState } from "react";

type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

// Small shared hook so every page follows the same loading/error/success pattern
// instead of re-implementing fetch state each time.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fn()
      .then((data) => !cancelled && setState({ status: "success", data }))
      .catch((err) => !cancelled && setState({ status: "error", message: err?.message ?? "เกิดข้อผิดพลาด" }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) } as AsyncState<T> & { refetch: () => void };
}
