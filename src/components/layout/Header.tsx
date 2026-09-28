import { Menu, Search, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

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

      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-faint lg:max-w-md">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">ค้นหาฮีโร่, ไอเทม, คู่มือ...</span>
      </div>

      <Link
        to={user ? "/profile" : "/login"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-raised text-text-muted hover:text-text"
        aria-label="โปรไฟล์"
      >
        <User className="h-4 w-4" />
      </Link>
    </header>
  );
}
