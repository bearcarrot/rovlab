import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { norm } from "@/features/matches/scan";
import { cn } from "@/lib/utils";
import type { ItemSummary } from "@/types/item";

// Custom dropdown for one item slot (replaces the native <select>): the trigger shows the icon and name, the list is
// searchable and shows icon, English + Thai name and price. The list is rendered in a portal so no scrolling or clipping
// container can cut it off. Mouse, touch and keyboard (arrows, Enter, Escape, Tab) all work. The search box is focused
// automatically only on devices with a fine pointer, so the on-screen keyboard does not cover the list on phones.

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 340;
const GAP = 4;

export function ItemPicker({
  items,
  value,
  onChange,
  ariaLabel,
  unsure = false,
}: {
  /** Already sorted the way the list should be shown. */
  items: ItemSummary[];
  /** Item slug, or null for an empty slot. */
  value: string | null;
  onChange: (slug: string | null) => void;
  ariaLabel: string;
  /** The icon matcher was not clearly sure about this slot: draw the trigger with the accent border. */
  unsure?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const keyboardNav = useRef(false); // true when the highlighted row should be scrolled into view (not on mouse hover)
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);

  const current = useMemo(() => (value ? items.find((it) => it.slug === value) : undefined), [items, value]);

  // Row 0 is the "empty slot" choice, shown only while the search box is empty.
  const options = useMemo<(ItemSummary | null)[]>(() => {
    const q = norm(query);
    if (!q) return [null, ...items];
    return items.filter((it) => norm(it.name).includes(q) || norm(it.nameTh).includes(q) || norm(it.slug).includes(q));
  }, [items, query]);

  const placed = pos !== null;
  const showList = open && placed;

  function openList() {
    setQuery("");
    setActive(value ? Math.max(items.findIndex((it) => it.slug === value) + 1, 0) : 0);
    keyboardNav.current = true; // bring the current choice into view
    setOpen(true);
  }

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(it: ItemSummary | null) {
    onChange(it ? it.slug : null);
    close(true);
  }

  function move(next: number) {
    keyboardNav.current = true;
    setActive(Math.min(Math.max(next, 0), Math.max(options.length - 1, 0)));
  }

  // Keep the panel next to the trigger (flips above it when there is no room below).
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const viewH = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(Math.max(r.width, 288), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = viewH - r.bottom - GAP - 8;
      const above = r.top - GAP - 8;
      const flip = below < 240 && above > below;
      const maxHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, flip ? above : below));
      setPos(
        flip
          ? { left, width, bottom: window.innerHeight - r.top + GAP, maxHeight }
          : { left, width, top: r.bottom + GAP, maxHeight }
      );
    };
    // scrolling the option list itself must not re-place the panel
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      place();
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", place);
      setPos(null);
    };
  }, [open]);

  // Tap / click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (triggerRef.current?.contains(t) || panelRef.current?.contains(t))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open && placed && window.matchMedia?.("(pointer: fine)").matches) searchRef.current?.focus({ preventScroll: true });
  }, [open, placed]);

  // Scroll the highlighted row into view inside the list only (never the page).
  useEffect(() => {
    if (!showList || !keyboardNav.current) return;
    keyboardNav.current = false;
    const li = document.getElementById(`${id}-opt-${active}`);
    const ul = listRef.current;
    if (!li || !ul) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) {
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
    }
  }, [showList, active, id]);

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < options.length) choose(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const display = current ? current.name : value ? value : "— ว่าง —";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${ariaLabel}: ${display}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            openList();
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            close(false);
          }
        }}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-lg border bg-bg p-2 text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          unsure ? "border-accent" : "border-border"
        )}
      >
        {current?.icon ? (
          <img src={current.icon} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded object-cover" />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded bg-bg-surface" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-text-muted")}>{display}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-faint transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {showList &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            className="z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-bg-surface shadow-card"
          >
            <div className="shrink-0 border-b border-border p-1.5">
              <input
                ref={searchRef}
                role="combobox"
                aria-label="ค้นหาไอเทม"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={options[active] !== undefined ? `${id}-opt-${active}` : undefined}
                autoComplete="off"
                value={query}
                placeholder="ค้นหาไอเทม…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              // keep focus in the search box so pressing an option does not blur it first
              onMouseDown={(e) => e.preventDefault()}
              className="relative min-h-0 flex-1 overflow-y-auto p-1"
            >
              {options.length === 0 && (
                <li role="presentation" className="px-2 py-3 text-center text-xs text-text-muted">
                  ไม่พบไอเทมที่ตรงกับคำค้น
                </li>
              )}
              {options.map((it, i) => {
                const selected = it ? it.slug === value : value === null;
                return (
                  <li
                    key={it ? it.slug : "__empty"}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(it)}
                    className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5", i === active && "bg-bg-raised")}
                  >
                    {it?.icon ? (
                      <img
                        src={it.icon}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 shrink-0 rounded bg-bg-raised object-cover"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded bg-bg-raised" />
                    )}
                    {it ? (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text">{it.name}</span>
                        <span className="block truncate text-[11px] text-text-faint">{it.nameTh}</span>
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">— ว่าง —</span>
                    )}
                    {it && it.cost > 0 && (
                      <span className="shrink-0 text-[11px] tabular-nums text-text-faint">{it.cost.toLocaleString()}</span>
                    )}
                    {selected && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
