import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { NAME_PARAM, PATCH_PARAM, SHARE_PARAM } from "./linkCodec";

export interface IncomingShare {
  code: string;
  name: string;
  patch: string;
}

/**
 * Picks up a share link (?s=...) once per code, strips the share params from the URL right away
 * (so refresh / back never re-triggers it), then calls `onIncoming`.
 * `enabled` lets a page wait for data it needs (e.g. the hero list) before the link is consumed.
 */
export function useIncomingShare(onIncoming: (p: IncomingShare) => void | Promise<void>, enabled = true) {
  const [params, setParams] = useSearchParams();
  const code = params.get(SHARE_PARAM);
  const handled = useRef<string | null>(null);
  const latest = useRef(onIncoming);
  latest.current = onIncoming;

  useEffect(() => {
    if (!enabled || !code || handled.current === code) return;
    handled.current = code; // also guards React StrictMode's double effect
    const incoming: IncomingShare = {
      code,
      name: (params.get(NAME_PARAM) ?? "").trim().slice(0, 80),
      patch: (params.get(PATCH_PARAM) ?? "").trim().slice(0, 20),
    };
    const next = new URLSearchParams(params);
    for (const k of [SHARE_PARAM, NAME_PARAM, PATCH_PARAM]) next.delete(k);
    setParams(next, { replace: true });
    void latest.current(incoming);
  }, [enabled, code, params, setParams]);
}
