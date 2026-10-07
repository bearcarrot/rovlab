import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/AuthContext";

/** Google OAuth Client ID (Web) */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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

/** nonce ดิบ (ส่งให้ Supabase) + แบบ SHA-256 hex (ส่งให้ Google) */
async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

interface Props {
  onBusyChange?: (busy: boolean) => void;
  onError?: (code?: string) => void;
  /** ข้อความบนปุ่ม: signin_with = ลงชื่อเข้าใช้ด้วย Google, signup_with = ลงทะเบียนด้วย Google */
  text?: "signin_with" | "signup_with";
}

/**
 * ปุ่ม Google Sign-In (Google Identity Services) → signInWithIdToken
 * ไม่ redirect ไป supabase.co จึงไม่มีโดเมน supabase.co โผล่ในหน้าเลือกบัญชี
 * (signInWithIdToken สร้างบัญชีให้อัตโนมัติหากยังไม่มี จึงใช้ทั้งหน้า Login และ Register)
 */
export function GoogleIdTokenButton({ onBusyChange, onError, text = "signin_with" }: Props) {
  const { signInWithGoogleIdToken } = useAuth();
  const holderRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onBusyChange, onError, signInWithGoogleIdToken });
  handlers.current = { onBusyChange, onError, signInWithGoogleIdToken };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([createNonce(), loadGis()]);
        const holder = holderRef.current;
        if (cancelled || !holder || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          callback: async (res) => {
            handlers.current.onBusyChange?.(true);
            const { error, code } = await handlers.current.signInWithGoogleIdToken(res.credential, raw);
            if (error) {
              handlers.current.onError?.(code);
              handlers.current.onBusyChange?.(false);
            }
            // สำเร็จ: onAuthStateChange จะอัปเดต session แล้วหน้านั้นจะ navigate เอง
          },
        });

        const width = Math.min(400, Math.max(200, Math.round(holder.clientWidth || 320)));
        window.google.accounts.id.renderButton(holder, {
          type: "standard",
          theme: "filled_black",
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

  // color-scheme: light — iframe ของ Google เป็น light; ถ้าหน้าเว็บเป็น dark จะมีพื้นหลังขาวล้อมปุ่ม
  return <div ref={holderRef} className="flex w-full justify-center" style={{ colorScheme: "light" }} />;
}
