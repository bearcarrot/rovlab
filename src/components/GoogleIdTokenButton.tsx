import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { GoogleIcon } from "@/components/GoogleIcon";

/** Google OAuth Client ID (Web) */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Solid white button (same sizing as the site's other auth buttons) */
const whiteBtnCls =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-white bg-white py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-60";

interface CredentialResponse {
  credential: string;
}

interface GisId {
  initialize(cfg: {
    client_id: string;
    callback: (res: CredentialResponse) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
    ux_mode?: "popup";
  }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GisId } };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("gis_load_failed"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** raw nonce (sent to Supabase) + SHA-256 hex of it (sent to Google) */
async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

// Google's size="large" button is always 40px tall
const GIS_BUTTON_HEIGHT = 40;

interface Props {
  onBusyChange?: (busy: boolean) => void;
  onError?: (code?: string) => void;
  /** signin_with = login label, signup_with = register label */
  text?: "signin_with" | "signup_with";
}

/**
 * Google Sign-In (Google Identity Services) -> signInWithIdToken, no redirect to supabase.co.
 *
 * The visible button is the site's own white button. Google's real button (an iframe, which
 * cannot be restyled) is rendered on top of it with near-zero opacity and stretched to cover it,
 * so clicks land on Google's iframe while users only see the site-styled button.
 */
export function GoogleIdTokenButton({ onBusyChange, onError, text = "signin_with" }: Props) {
  const { signInWithGoogleIdToken } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const handlers = useRef({ onBusyChange, onError, signInWithGoogleIdToken });
  handlers.current = { onBusyChange, onError, signInWithGoogleIdToken };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([createNonce(), loadGis()]);
        const wrap = wrapRef.current;
        const holder = holderRef.current;
        if (cancelled || !wrap || !holder || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          callback: async (res) => {
            setBusy(true);
            handlers.current.onBusyChange?.(true);
            const { error, code } = await handlers.current.signInWithGoogleIdToken(res.credential, raw);
            if (error) {
              handlers.current.onError?.(code);
              handlers.current.onBusyChange?.(false);
              setBusy(false);
            }
            // success: onAuthStateChange updates the session and the page navigates by itself
          },
        });

        const width = Math.min(400, Math.max(200, Math.round(wrap.clientWidth || 320)));
        const height = wrap.clientHeight || GIS_BUTTON_HEIGHT;
        // stretch the iframe vertically so it covers the whole site button
        holder.style.transformOrigin = "top left";
        holder.style.transform = `scaleY(${height / GIS_BUTTON_HEIGHT})`;
        window.google.accounts.id.renderButton(holder, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          locale: "th",
          width,
        });
      } catch {
        handlers.current.onError?.("google_script_failed");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = text === "signup_with" ? "สมัครด้วย Google" : "เข้าสู่ระบบด้วย Google";

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* visible site-styled button; not clickable itself */}
      <button type="button" tabIndex={-1} aria-hidden disabled={busy} className={`${whiteBtnCls} pointer-events-none`}>
        <GoogleIcon />
        {label}
      </button>
      {/* Google's real button, invisible, laid over the site button */}
      <div
        className={`absolute inset-0 overflow-hidden opacity-[0.01] ${busy ? "pointer-events-none" : ""}`}
        style={{ colorScheme: "light" }}
      >
        <div ref={holderRef} />
      </div>
    </div>
  );
}
