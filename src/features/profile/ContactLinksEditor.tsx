import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ContactAppIcon } from "@/features/profile/ContactAppIcon";
import { CONTACT_APPS, getContactApp, validateContactUrl } from "@/features/profile/contactApps";
import { cn } from "@/lib/utils";
import type { ContactAppId, ContactLink } from "@/types/profile";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60";

export function ContactLinksEditor({ value, onChange }: { value: ContactLink[]; onChange: (v: ContactLink[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [appId, setAppId] = useState<ContactAppId | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const available = CONTACT_APPS.filter((a) => !value.some((v) => v.app === a.id));
  const selected = appId ? getContactApp(appId) : null;

  function reset() {
    setAdding(false);
    setAppId(null);
    setUrl("");
    setError(null);
  }

  function add() {
    if (!appId) return setError("เลือกแอปก่อน");
    const r = validateContactUrl(appId, url);
    if (!r.ok) return setError(r.error);
    onChange([...value, { app: appId, url: r.url }]);
    reset();
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((l) => {
            const app = getContactApp(l.app);
            return (
              <li key={l.app} className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2">
                <ContactAppIcon app={l.app} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{app.label}</p>
                  <p className="truncate text-[11px] text-text-faint">{l.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v.app !== l.app))}
                  aria-label={`ลบ ${app.label}`}
                  className="shrink-0 p-1.5 text-text-faint hover:text-loss"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
          <p className="text-xs font-medium text-text-muted">เลือกแอป</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {available.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAppId(a.id);
                  setError(null);
                }}
                aria-pressed={appId === a.id}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2",
                  appId === a.id ? "border-accent bg-accent/10" : "border-border"
                )}
              >
                <ContactAppIcon app={a.id} className="h-9 w-9" />
                <span className="w-full truncate text-center text-[10px] text-text-muted">{a.label}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-1.5">
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={300}
                placeholder={selected.placeholder}
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-text-faint">
                วางลิงก์ทางการของ {selected.label} เท่านั้น ({selected.hosts.join(", ")}) ลิงก์ของเว็บอื่นจะถูกปฏิเสธ
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted hover:text-text"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={add}
              disabled={!appId || !url.trim()}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      ) : available.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-text-muted hover:text-text"
        >
          <Plus className="h-4 w-4" />
          เพิ่มช่องทางติดต่อ
        </button>
      ) : (
        <p className="text-xs text-text-faint">เพิ่มครบทุกแอปแล้ว</p>
      )}
    </div>
  );
}
