import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border py-14 text-center">
      <Icon className="h-8 w-8 text-text-faint" strokeWidth={1.5} />
      <p className="font-display text-sm font-medium text-text">{title}</p>
      <p className="max-w-xs text-sm text-text-muted">{description}</p>
    </div>
  );
}
