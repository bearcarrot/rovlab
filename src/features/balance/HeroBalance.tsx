import { useAsync } from "@/hooks/useAsync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHeroBalance, BALANCE_LABEL } from "@/services/balance";
import { BalanceIcon, BALANCE_TEXT_CLASS } from "./BalanceIcon";

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

// "ก่อน → หลัง": ค่าเดิมจาง ๆ ค่าใหม่เน้น
function ChangeText({ text }: { text: string }) {
  const i = text.indexOf("→");
  if (i < 0) return <span>{text}</span>;
  return (
    <>
      <span className="text-text-faint">{text.slice(0, i).trimEnd()}</span>{" "}
      <span className="text-text-muted">→</span>{" "}
      <span className="font-medium text-text">{text.slice(i + 1).trim()}</span>
    </>
  );
}

// ส่วน "ปรับสมดุลล่าสุด" ในหน้ารายละเอียดฮีโร่ — ไม่มีข้อมูลก็ไม่แสดงอะไร
export function HeroBalance({ heroId }: { heroId: string }) {
  const q = useAsync(() => getHeroBalance(heroId), [heroId]);
  if (q.status !== "success" || !q.data || q.data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ปรับสมดุลล่าสุด</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.data.map((c) => (
          <div key={c.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <BalanceIcon kind={c.kind} className="h-4 w-4" />
              <span className={`font-display text-sm font-medium ${BALANCE_TEXT_CLASS[c.kind]}`}>{BALANCE_LABEL[c.kind]}</span>
              <span className="text-xs text-text-faint">
                {fmtDate(c.changedAt)}
                {c.patch ? ` · แพตช์ ${c.patch}` : ""}
              </span>
            </div>
            {c.reason && <p className="text-sm text-text-muted">{c.reason}</p>}
            {c.skills.length > 0 && (
              <ul className="space-y-1.5">
                {c.skills.map((s, i) => (
                  <li key={i} className="rounded-lg border border-border bg-bg-raised p-2.5 text-sm">
                    <p className="text-xs font-medium text-text-muted">
                      {s.slot}
                      {s.name ? ` · ${s.name}` : ""}
                    </p>
                    <p className="mt-0.5 break-words">
                      <ChangeText text={s.content} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
