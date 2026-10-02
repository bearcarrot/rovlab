import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon for every "ask the AI coach" button: a spinner while the request is running, sparkles otherwise.
export function CoachIcon({ busy, className }: { busy: boolean; className?: string }) {
  const Icon = busy ? Loader2 : Sparkles;
  return <Icon aria-hidden className={cn("text-accent", busy && "animate-spin", className)} />;
}
