import { NavLink } from "react-router-dom";
import { LayoutDashboard, Swords, Users, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "หน้าแรก", icon: LayoutDashboard, end: true },
  { to: "/heroes", label: "ฮีโร่", icon: Swords },
  { to: "/draft", label: "ดราฟต์", icon: Users },
  { to: "/stats", label: "สถิติ", icon: BarChart3 },
];

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
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-text-faint",
              isActive && "text-accent"
            )
          }
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
      <button
        onClick={onOpenDrawer}
        className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-text-faint"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
        เพิ่มเติม
      </button>
    </nav>
  );
}
