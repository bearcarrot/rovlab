import { NavLink } from "react-router-dom";
import { X, Swords, BarChart3, GitCompareArrows, Users, Hammer, BookOpen, Heart, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ITEMS = [
  { to: "/", label: "แดชบอร์ด", icon: LayoutDashboard, end: true },
  { to: "/heroes", label: "ฮีโร่ทั้งหมด", icon: Swords },
  { to: "/tier-list", label: "Tier List", icon: BarChart3 },
  { to: "/counter-pick", label: "Counter Pick", icon: GitCompareArrows },
  { to: "/matchup", label: "Matchup", icon: GitCompareArrows },
  { to: "/draft", label: "Draft Assistant", icon: Users },
  { to: "/build", label: "Item Build", icon: Hammer },
  { to: "/stats", label: "สถิติ", icon: BarChart3 },
  { to: "/learn", label: "คู่มือ", icon: BookOpen },
  { to: "/favorites", label: "รายการโปรด", icon: Heart },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // React 18 does not support the boolean `inert` prop, so set it as an empty-string
  // attribute while closed. `inert` removes the subtree from the accessibility tree
  // AND from the tab order, which `aria-hidden` alone does not (links inside stayed focusable).
  const inertProps = open ? {} : { inert: "" };

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      {...inertProps}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-72 max-w-[80vw] border-r border-border bg-bg-surface transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-display text-lg font-semibold">RoV LAB</span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted" aria-label="ปิดเมนู">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-0.5 px-3 pb-6">
          {ALL_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm text-text-muted",
                  isActive && "bg-bg-raised text-text font-medium"
                )
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
