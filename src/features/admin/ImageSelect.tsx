import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type ImgOpt = { id: string; label: string; icon?: string; alt?: string };

// ตัดตัวพิมพ์/ช่องว่าง/เครื่องหมายออก ให้พิมพ์ "azzenka" ก็เจอ Azzen'Ka
const squash = (s: string) => s.toLowerCase().replace(/[\s'’`"\-_.]/g, "");

// รูปเล็ก: รูปโหลดไม่ได้/ไม่มีรูป = แสดงตัวอักษรย่อแทน
export function Thumb({ src, label, round, className = "h-7 w-7" }: { src?: string; label: string; round?: boolean; className?: string }) {
  const [bad, setBad] = useState(false);
  const shape = round ? "rounded-[50%]" : "rounded-md";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-bg-raised ${shape} ${className}`}>
      {src && !bad ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBad(true)}
        />
      ) : (
        <span className="font-display text-[10px] text-text-faint">{label.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

// Dropdown ที่โชว์รูปในรายการ (select ปกติใส่รูปใน option ไม่ได้)
// รายการกางออกใต้ปุ่มในเลย์เอาต์ปกติ (ไม่ลอย) กันถูกการ์ดที่ overflow-hidden ตัด
export function ImageSelect({
  value,
  options,
  onChange,
  round,
  placeholder = "— เลือก —",
  clearable = true,
  className = "",
}: {
  value: string;
  options: ImgOpt[];
  onChange: (id: string) => void;
  round?: boolean;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const list = useMemo(() => {
    const n = squash(q);
    return n ? options.filter((o) => squash(`${o.label} ${o.alt ?? ""}`).includes(n)) : options;
  }, [options, q]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className={`min-w-0 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-bg-raised px-3 text-left text-base text-text outline-none transition focus:border-accent sm:text-sm"
      >
        {selected ? <Thumb src={selected.icon} label={selected.label} round={round} /> : null}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-text-faint"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-1 overflow-hidden rounded-lg border border-border bg-bg-surface">
          {options.length > 8 && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา..."
                className="h-10 w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
              />
            </div>
          )}
          <ul role="listbox" className="max-h-72 overflow-y-auto">
            {clearable && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="flex h-11 w-full items-center px-3 text-left text-sm text-text-faint hover:bg-bg-raised"
                >
                  {placeholder}
                </button>
              </li>
            )}
            {list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => pick(o.id)}
                  className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-raised ${
                    o.id === value ? "bg-accent/10 text-accent" : ""
                  }`}
                >
                  <Thumb src={o.icon} label={o.label} round={round} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.id === value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-text-muted">ไม่พบรายการ</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
