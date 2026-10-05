import { Chip, ROLE_OPTIONS, useFilterIcons } from "@/features/heroes/HeroFilters";
import { sortByOrder } from "@/services/filterIcons";
import { cn } from "@/lib/utils";

// Multi-select used when editing the profile. Same icons / names / order as the hero filters (from the DB).
export function RoleMultiSelect({ value, onToggle }: { value: string[]; onToggle: (role: string) => void }) {
  const icons = useFilterIcons();
  return (
    <div className="flex flex-wrap gap-2">
      {sortByOrder(ROLE_OPTIONS, icons.roleOrder).map((r) => (
        <Chip
          key={r.value}
          active={value.includes(r.value)}
          onClick={() => onToggle(r.value)}
          label={icons.roleLabels[r.value] ?? r.label}
          icon={icons.roles[r.value]}
          showLabel
        />
      ))}
    </div>
  );
}

// Read-only badges for the public profile.
export function RoleBadges({ roles }: { roles: string[] }) {
  const icons = useFilterIcons();
  const shown = sortByOrder(
    ROLE_OPTIONS.filter((r) => roles.includes(r.value)),
    icons.roleOrder
  );
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((r) => {
        const icon = icons.roles[r.value];
        return (
          <span
            key={r.value}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-accent bg-accent py-1.5 text-xs font-medium text-accent-fg",
              icon ? "px-2.5" : "px-3"
            )}
          >
            {icon && (
              <img
                src={icon}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-5 w-5 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            {icons.roleLabels[r.value] ?? r.label}
          </span>
        );
      })}
    </div>
  );
}
