import { NavLink } from "react-router-dom";
import {
  Home,
  GitCompareArrows,
  Swords,
  Scale,
  NotebookPen,
  BarChart3,
  ClipboardList,
  ListOrdered,
  BookOpen,
  Heart,
  Hammer,
  Library,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { HeroHelmetIcon } from "@/components/HeroHelmetIcon";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/features/auth/useIsAdmin";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "หลัก",
    items: [{ to: "/", label: "หน้าแรก", icon: Home, end: true }],
  },
  {
    label: "ฮีโร่",
    items: [
      { to: "/heroes", label: "ฮีโร่ทั้งหมด", icon: HeroHelmetIcon },
      { to: "/tier-list", label: "Tier List", icon: ListOrdered },
      { to: "/counter-pick", label: "Counter Pick", icon: Swords },
      { to: "/matchup", label: "Matchup", icon: Scale },
    ],
  },
  {
    label: "ดราฟต์",
    items: [{ to: "/draft", label: "Draft Assistant", icon: NotebookPen }],
  },
  {
    label: "บิลด์ & ข้อมูลเกม",
    items: [
      { to: "/build", label: "Item Build", icon: Hammer },
      { to: "/game-data", label: "คลังข้อมูลเกม", icon: Library },
    ],
  },
  {
    label: "สถิติ",
    items: [
      { to: "/stats", label: "สถิติ", icon: BarChart3 },
      { to: "/matches", label: "วิเคราะห์เกม", icon: ClipboardList },
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
        <img src="/logo-64.webp" alt="RoV LAB" width={36} height={36} className="h-9 w-9 shrink-0" />
        <span className="font-display text-lg font-semibold tracking-tight">RoV LAB</span>
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
