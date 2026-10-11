import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroRoles } from "@/lib/heroPositions";
import { norm } from "@/features/matches/scan";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

// Searchable hero picker (replaces the native <datalist>): icon, English + Thai name and every role the hero has in the database.
// The list is rendered in a portal because the review table scrolls horizontally and would clip an absolutely positioned popup.
// The text box keeps the typed value, so heroes that are not in the database can still be saved as plain text.

const MAX_RESULTS = 50;

type Pos = { left: number; width: number; top?: number; bottom?: number };

export function HeroCombobox({
  value,
  onChange,
  heroes,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  heroes: HeroSummary[];
  ariaLabel: string;
  className?: string;
}) {
  const { roleLabel } = useFilterLabels();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);

  const results = useMemo(() => {
    const q = norm(value);
    const list = q
      ? heroes.filter(
          (h) =>
            norm(h.name).includes(q) ||
            norm(h.nameTh).includes(q) ||
            norm(h.slug).includes(q) ||
            heroRoles(h).some((r) => norm(roleLabel(r)).includes(q) || r.includes(q))
        )
      : heroes;
    return list.slice(0, MAX_RESULTS);
  }, [heroes, value, roleLabel]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 288);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const spaceBelow = window.innerHeight - r.bottom;
      const flip = spaceBelow < 240 && r.top > spaceBelow;
      setPos(flip ? { left, width, bottom: window.innerHeight - r.top + 4 } : { left, width, top: r.bottom + 4 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function choose(h: HeroSummary) {
    onChange(h.name);
    setOpen(false);
  }

  const showList = open && pos !== null;
  const listId = `${id}-list`;

  return (
    <>
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="ค้นหาฮีโร่…"
        onFocus={(e) => {
          e.currentTarget.select();
          setActive(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && showList && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={className}
      />
      {showList &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            // keep focus in the input so clicking an option does not blur (and close) the list first
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            className="z-[60] max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-surface p-1 shadow-card"
          >
            {results.length === 0 && <li className="px-2 py-3 text-center text-xs text-text-muted">ไม่พบฮีโร่ที่ตรงกับคำค้น</li>}
            {results.map((h, i) => (
              <li
                key={h.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5", i === active && "bg-bg-raised")}
              >
                {h.icon ? (
                  <img
                    src={h.icon}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 rounded bg-bg-raised object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-raised font-display text-[11px] text-text-faint">
                    {h.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{h.name}</span>
                  <span className="block truncate text-[11px] text-text-faint">{h.nameTh}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {heroRoles(h).map((r) => (
                    <span key={r} className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">
                      {roleLabel(r)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
