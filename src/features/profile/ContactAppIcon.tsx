import { Facebook, Gamepad2, Instagram, MessageCircle, Music2, Send, Twitch, X, Youtube } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactAppId } from "@/types/profile";

// App-colored tile + glyph (not the official logos).
const STYLES: Record<ContactAppId, { bg: string; Icon: LucideIcon }> = {
  line: { bg: "#06C755", Icon: MessageCircle },
  facebook: { bg: "#1877F2", Icon: Facebook },
  discord: { bg: "#5865F2", Icon: Gamepad2 },
  instagram: { bg: "linear-gradient(45deg,#F9A825,#E1306C,#7B3FBF)", Icon: Instagram },
  tiktok: { bg: "#111111", Icon: Music2 },
  youtube: { bg: "#FF0000", Icon: Youtube },
  x: { bg: "#111111", Icon: X },
  twitch: { bg: "#9146FF", Icon: Twitch },
  telegram: { bg: "#26A5E4", Icon: Send },
};

export function ContactAppIcon({ app, className }: { app: ContactAppId; className?: string }) {
  const { bg, Icon } = STYLES[app];
  return (
    <span
      className={cn("flex items-center justify-center rounded-xl text-white", className)}
      style={{ background: bg }}
      aria-hidden="true"
    >
      <Icon className="h-1/2 w-1/2" />
    </span>
  );
}
