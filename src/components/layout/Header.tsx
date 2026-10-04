import { Menu, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useMyAvatar } from "@/features/profile/useMyAvatar";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { RankToggle } from "@/components/layout/RankToggle";
import { UserAvatar } from "@/components/UserAvatar";

export function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { user } = useAuth();
  const avatarUrl = useMyAvatar();

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

      {/* bell sits to the left of the profile button (renders only when signed in) */}
      <NotificationBell />

      <Link
        to={user ? "/profile" : "/login"}
        className="shrink-0 rounded-full text-text-muted hover:text-text"
        aria-label="โปรไฟล์"
      >
        {/* photo when the user has one; otherwise the original user icon */}
        <UserAvatar name="โปรไฟล์" url={avatarUrl} fallback={<User className="h-4 w-4" />} className="h-9 w-9 text-text-muted" />
      </Link>
    </header>
  );
}
