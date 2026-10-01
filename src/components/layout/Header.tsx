import { Menu, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { RankToggle } from "@/components/layout/RankToggle";

export function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { user } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/90 px-4 backdrop-blur lg:h-16 lg:px-6"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        onClick={onOpenDrawer}
        className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised hover:text-text lg:hidden"
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* spacer: keeps the rank toggle and profile button on the right */}
      <div className="flex-1" />

      <RankToggle />

      <Link
        to={user ? "/profile" : "/login"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-muted hover:text-text"
        aria-label="โปรไฟล์"
      >
        <User className="h-4 w-4" />
      </Link>
    </header>
  );
}
