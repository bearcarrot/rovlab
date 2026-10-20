// Document Picture-in-Picture (Chromium 116+ desktop). TS 5.6's lib.dom has no type for it, so we type only what we use
// here instead of a global declaration or loosening tsconfig.
interface DocumentPipApi {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

/** Feature detection only (no UA sniffing). Returns null where the API is missing (Firefox, Safari, iOS, most Android). */
export function getDocumentPip(g: object = globalThis): DocumentPipApi | null {
  const api = (g as { documentPictureInPicture?: DocumentPipApi }).documentPictureInPicture;
  return api && typeof api.requestWindow === "function" ? api : null;
}

/** The PiP document starts empty: copy the theme class and every stylesheet from the main page. */
export function copyStyles(from: Document, to: Document) {
  to.documentElement.className = from.documentElement.className; // "dark"
  to.documentElement.lang = from.documentElement.lang;
  to.body.className = from.body.className;
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const style = to.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      to.head.appendChild(style);
    } catch {
      // Cross-origin sheet (Google Fonts): cssRules throws, so link it instead.
      if (!sheet.href) continue;
      const link = to.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      to.head.appendChild(link);
    }
  }
}
