import { useCallback, useEffect, useRef, useState } from "react";
import { copyStyles, getDocumentPip } from "./documentPip";

// Owns the floating window only. Draft state stays in useDraftSession on the page; the page renders into `win` with a portal.
export function useDocumentPip() {
  const [supported] = useState(() => getDocumentPip() !== null);
  // Unsupported on a desktop-class pointer: the button is shown disabled with the reason. On touch devices it is not shown at all.
  const [desktop] = useState(() => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches);
  const [win, setWin] = useState<Window | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opening = useRef(false);

  const open = useCallback(async () => {
    const pip = getDocumentPip();
    if (!pip || opening.current || win) return; // one window, one listener
    opening.current = true;
    setError(null);
    try {
      // Must run inside the click handler (user gesture). `win` is only set after the browser resolves the promise.
      const w = await pip.requestWindow({ width: 380, height: 600 });
      w.document.title = "RoV LAB Draft";
      copyStyles(document, w.document);
      w.addEventListener("pagehide", () => setWin(null), { once: true });
      setWin(w);
    } catch (e) {
      setError(`เปิดหน้าต่างลอยไม่สำเร็จ${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
    } finally {
      opening.current = false;
    }
  }, [win]);

  const close = useCallback(() => win?.close(), [win]); // pagehide clears `win`

  // Leaving the page closes the floating window; the draft lives in sessionStorage so nothing is lost.
  useEffect(() => () => win?.close(), [win]);

  return { supported, showButton: supported || desktop, win, error, open, close };
}
