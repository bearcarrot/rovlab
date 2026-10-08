import { cn } from "@/lib/utils";

/** Accessible on/off switch (role="switch"). Used for Public/Private and Global BP. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("flex items-center gap-2 text-sm disabled:opacity-60", className)}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-bg-raised ring-1 ring-inset ring-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full shadow transition-transform",
            checked ? "translate-x-[18px] bg-white" : "translate-x-0.5 bg-text-faint"
          )}
        />
      </span>
      {label !== undefined && <span>{label}</span>}
    </button>
  );
}
