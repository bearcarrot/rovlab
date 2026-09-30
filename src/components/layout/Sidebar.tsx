import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Swords,
  Users,
  GitCompareArrows,
  Hammer,
  BarChart3,
  BookOpen,
  Heart,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/features/auth/useIsAdmin";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "หลัก",
    items: [{ to: "/", label: "แดชบอร์ด", icon: LayoutDashboard, end: true }],
  },
  {
    label: "ฮีโร่",
    items: [
      { to: "/heroes", label: "ฮีโร่ทั้งหมด", icon: Swords },
      { to: "/tier-list", label: "Tier List", icon: BarChart3 },
      { to: "/counter-pick", label: "Counter Pick", icon: GitCompareArrows },
      { to: "/matchup", label: "Matchup", icon: GitCompareArrows },
    ],
  },
  {
    label: "ดราฟต์",
    items: [{ to: "/draft", label: "Draft Assistant", icon: Users }],
  },
  {
    label: "บิลด์ & สถิติ",
    items: [
      { to: "/build", label: "Item Build", icon: Hammer },
      { to: "/stats", label: "สถิติ", icon: BarChart3 },
    ],
  },
  {
    label: "เรียนรู้",
    items: [
      { to: "/learn", label: "คู่มือ", icon: BookOpen },
      { to: "/favorites", label: "รายการโปรด", icon: Heart },
    ],
  },
];

const ADMIN_ITEM: NavItem = { to: "/admin", label: "แอดมิน", icon: ShieldCheck };

export function Sidebar() {
  const { isAdmin } = useIsAdmin();
  // แอดมินเห็นเมนูแอดมินอยู่ใต้รายการโปรด
  const groups = NAV_GROUPS.map((g) =>
    isAdmin && g.label === "เรียนรู้" ? { ...g, items: [...g.items, ADMIN_ITEM] } : g
  );

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <img src="/logo.png" alt="RovLab" width={36} height={36} className="h-9 w-9 shrink-0" />
        <span className="font-display text-lg font-semibold tracking-tight">RovLab</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-xs font-medium text-text-faint">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-bg-raised hover:text-text",
                        isActive && "bg-bg-raised text-text font-medium"
                      )
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
