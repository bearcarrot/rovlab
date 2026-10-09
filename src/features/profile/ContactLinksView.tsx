import { useState } from "react";
import { ContactAppIcon } from "@/features/profile/ContactAppIcon";
import { ExternalLinkDialog } from "@/features/profile/ExternalLinkDialog";
import { getContactApp, validateContactUrl } from "@/features/profile/contactApps";
import type { ContactLink } from "@/types/profile";

// Read-only row of app icons. Tapping one opens the external-link warning first; nothing opens directly.
// Links are re-validated here too, so a bad value in the database is never rendered.
export function ContactLinksView({ links }: { links: ContactLink[] }) {
  const [pending, setPending] = useState<ContactLink | null>(null);

  const safe: ContactLink[] = [];
  for (const l of links) {
    const r = validateContactUrl(l.app, l.url);
    if (r.ok) safe.push({ app: l.app, url: r.url });
  }
  if (safe.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {safe.map((l) => {
          const app = getContactApp(l.app);
          return (
            <button
              key={l.app}
              type="button"
              onClick={() => setPending(l)}
              aria-label={`เปิดลิงก์ ${app.label}`}
              title={app.label}
              className="flex min-w-12 flex-col items-center gap-1 py-1"
            >
              <ContactAppIcon app={l.app} className="h-11 w-11" />
              <span className="text-xs text-text-muted">{app.label}</span>
            </button>
          );
        })}
      </div>
      <ExternalLinkDialog link={pending} onClose={() => setPending(null)} />
    </>
  );
}
