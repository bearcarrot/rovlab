import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";

// Placeholder for routes not yet built in this pass (see MVP order in the README).
// Each will become its own page under src/pages as the corresponding step is built.
export function ComingSoon({ title, icon, description }: { title: string; icon: LucideIcon; description: string }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <EmptyState icon={icon} title="กำลังพัฒนา" description={description} />
    </div>
  );
}
