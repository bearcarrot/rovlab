import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextReaction, type Reaction } from "./reactions";

export function ReactionButtons({
  likes,
  dislikes,
  value,
  disabled,
  onChange,
}: {
  likes: number;
  dislikes: number;
  value: Reaction;
  disabled?: boolean;
  onChange: (next: Reaction) => void;
}) {
  const base = "flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-pressed={value === 1}
        aria-label={`ถูกใจ ${likes}`}
        disabled={disabled}
        onClick={() => onChange(nextReaction(value, 1))}
        className={cn(base, value === 1 ? "border-win bg-win/10 text-win" : "border-border text-text-muted hover:text-text")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {likes}
      </button>
      <button
        type="button"
        aria-pressed={value === -1}
        aria-label={`ไม่ถูกใจ ${dislikes}`}
        disabled={disabled}
        onClick={() => onChange(nextReaction(value, -1))}
        className={cn(base, value === -1 ? "border-loss bg-loss/10 text-loss" : "border-border text-text-muted hover:text-text")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        {dislikes}
      </button>
    </div>
  );
}
