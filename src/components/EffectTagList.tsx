import { cn } from "@/lib/utils";
import { GROUP_STYLE, sortTags, tagGroup, type EffectTag } from "@/lib/effectTags";

export function EffectTagBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        GROUP_STYLE[tagGroup(name)],
        className
      )}
    >
      {name}
    </span>
  );
}

// ไม่มีแท็ก (ยังไม่ได้นำเข้า) = ไม่แสดงอะไร ไม่ให้หน้าว่างเปล่าดูแปลก
export function EffectTagList({ tags, className }: { tags: EffectTag[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sortTags(tags).map((t) => (
        <EffectTagBadge key={t.name} name={t.name} />
      ))}
    </div>
  );
}
