import { ContactAppIcon } from "@/features/profile/ContactAppIcon";
import { SITE, SOCIAL_LINKS } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const focusCls =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface";

// RoV LAB's own channels, read from SOCIAL_LINKS. "icons" = compact icon-only row (footer);
// "labeled" = icon + name (Data Sources). Every link opens a new tab and has a full accessible name.
export function SocialLinks({ variant = "icons", className }: { variant?: "icons" | "labeled"; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-3", className)}>
      {SOCIAL_LINKS.map(({ id, label, href }) => (
        <li key={id}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${SITE.name} บน ${label} (เปิดในแท็บใหม่)`}
            title={label}
            className={cn(
              "group flex items-center gap-2 rounded-xl p-1 text-sm text-text-muted transition-colors hover:text-text",
              focusCls
            )}
          >
            <ContactAppIcon
              app={id}
              className="h-7 w-7 opacity-90 transition group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
            {variant === "labeled" && <span>{label}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
