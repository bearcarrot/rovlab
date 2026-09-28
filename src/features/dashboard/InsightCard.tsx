import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insight } from "@/types/insight";
import { cn } from "@/lib/utils";

const SEVERITY = {
  critical: { icon: AlertOctagon, color: "text-loss", label: "ควรแก้ด่วน" },
  moderate: { icon: AlertTriangle, color: "text-accent", label: "ควรฝึกเพิ่ม" },
  minor: { icon: Info, color: "text-rift", label: "ข้อสังเกต" },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const { icon: Icon, color, label } = SEVERITY[insight.severity];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} strokeWidth={2} />
          <CardTitle>{insight.title}</CardTitle>
        </div>
        <span className={cn("shrink-0 text-xs font-medium", color)}>{label}</span>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <p className="text-text-muted">{insight.whatHappened}</p>
        <div className="rounded-lg bg-bg-raised p-3 space-y-1.5">
          <p><span className="font-medium text-text">สาเหตุ: </span><span className="text-text-muted">{insight.whyItHappened}</span></p>
          <p><span className="font-medium text-text">ควรแก้: </span><span className="text-text-muted">{insight.whatToFix}</span></p>
          <p><span className="font-medium text-text">วิธีฝึก: </span><span className="text-text-muted">{insight.howToPractice}</span></p>
        </div>
        {insight.isMock && (
          <p className="text-[11px] text-text-faint">* ข้อมูลตัวอย่าง ยังไม่เชื่อมกับแมตช์จริง</p>
        )}
      </CardContent>
    </Card>
  );
}
