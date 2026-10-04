import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { COMMENT_MAX_LENGTH } from "@/services/comments";
import { communityError, searchHandles } from "@/services/community";
import type { HandleSuggestion } from "@/types/community";

interface Props {
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}

// Finds an in-progress "@query" right before the caret.
function detectToken(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([A-Za-z0-9_]{0,20})$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

export function CommentComposer({ placeholder, initialValue = "", submitLabel = "ส่ง", autoFocus, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [suggestions, setSuggestions] = useState<HandleSuggestion[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);

  const query = token?.query ?? "";
  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchHandles(query);
      if (!cancelled) setSuggestions(res);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function pick(handle: string) {
    if (!token) return;
    const before = value.slice(0, token.start);
    const after = value.slice(token.start + 1 + token.query.length);
    const inserted = `${before}@${handle} `;
    setValue(inserted + after);
    setToken(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(inserted.length, inserted.length);
    });
  }

  async function submit() {
    const body = value.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(body);
      setValue("");
    } catch (e) {
      setError(communityError(e, "ส่งความคิดเห็นไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          placeholder={placeholder ?? "แชร์เคล็ดลับหรือประสบการณ์... พิมพ์ @ เพื่อแท็กผู้ใช้"}
          onChange={(e) => {
            setValue(e.target.value);
            setToken(detectToken(e.target.value, e.target.selectionStart));
          }}
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60"
        />
        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-card">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p.handle);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-raised"
                >
                  <UserAvatar name={p.displayName?.trim() || p.handle} url={p.avatarUrl} className="h-7 w-7 text-xs" />
                  <span className="min-w-0 truncate">
                    {p.displayName?.trim() || p.handle} <span className="text-text-faint">@{p.handle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-faint">{value.length}/{COMMENT_MAX_LENGTH}</span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text">
              ยกเลิก
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || value.trim() === ""}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {busy ? "กำลังส่ง..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
