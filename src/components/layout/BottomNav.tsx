import { NavLink } from "react-router-dom";
import { Home, ListOrdered, NotebookPen, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

// Order: Home · Tier List · Draft Assistant · Stats · More (drawer).
// Heroes stays reachable from the drawer / sidebar and the Home page.
const ITEMS = [
  { to: "/", label: "หน้าแรก", icon: Home, end: true },
  { to: "/tier-list", label: "Tier List", icon: ListOrdered },
  { to: "/draft", label: "Draft Assistant", icon: NotebookPen },
  { to: "/stats", label: "สถิติ", icon: BarChart3 },
];

// "Draft Assistant" is too wide for one line on narrow phones (5 equal columns),
// so labels use leading-tight + text-center and may wrap to two lines.
const LABEL_CLS = "min-w-0 px-0.5 text-center text-[11px] leading-tight";

export function BottomNav({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-text-faint",
              isActive && "text-accent"
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
          <span className={LABEL_CLS}>{label}</span>
        </NavLink>
      ))}
      <button
        onClick={onOpenDrawer}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-text-faint"
      >
        <Menu className="h-5 w-5 shrink-0" strokeWidth={2} />
        <span className={LABEL_CLS}>เพิ่มเติม</span>
      </button>
    </nav>
  );
}
