import { NavLink } from "react-router-dom";
import {
  X,
  BarChart3,
  ListOrdered,
  Swords,
  Scale,
  NotebookPen,
  Users,
  BookOpen,
  Heart,
  Home,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { HeroHelmetIcon } from "@/components/HeroHelmetIcon";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/features/auth/useIsAdmin";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const ALL_ITEMS: NavItem[] = [
  { to: "/", label: "หน้าแรก", icon: Home, end: true },
  { to: "/heroes", label: "ฮีโร่ทั้งหมด", icon: HeroHelmetIcon },
  { to: "/tier-list", label: "Tier List", icon: ListOrdered },
  { to: "/counter-pick", label: "Counter Pick", icon: Swords },
  { to: "/matchup", label: "Matchup", icon: Scale },
  { to: "/draft", label: "Draft Assistant", icon: NotebookPen },
  { to: "/stats", label: "สถิติ", icon: BarChart3 },
  { to: "/learn", label: "คู่มือ", icon: BookOpen },
  { to: "/favorites", label: "รายการโปรด", icon: Heart },
];

const ADMIN_ITEM: NavItem = { to: "/admin", label: "แอดมิน", icon: ShieldCheck };

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAdmin } = useIsAdmin();
  const items = isAdmin ? [...ALL_ITEMS, ADMIN_ITEM] : ALL_ITEMS;

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
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
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="RoV LAB" width={32} height={32} className="h-8 w-8 shrink-0" />
            <span className="font-display text-lg font-semibold">RoV LAB</span>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted" aria-label="ปิดเมนู">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-0.5 px-3 pb-6">
          {items.map(({ to, label, icon: Icon, end }) => (
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
