import { type ReactNode } from "react";

// แสดงคำตอบของ Coach AI: AI มักตอบเป็น Markdown (**ตัวหนา**, 1. รายการ, - bullet, # หัวข้อ)
// แต่หน้าเว็บแสดงเป็นข้อความธรรมดา จึงเห็นเครื่องหมาย ** โผล่ — คอมโพเนนต์นี้แปลงส่วนที่ใช้บ่อยให้แสดงผลถูกต้อง
// (ไม่ใช้ dangerouslySetInnerHTML จึงปลอดภัยแม้ AI ตอบ HTML มา)

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`/g;
  const plain = (s: string) => s.replace(/\*\*/g, ""); // ** ที่เปิดไว้แต่ไม่ปิด (เช่น คำตอบถูกตัด) ไม่ให้ค้างบนจอ
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(plain(text.slice(last, m.index)));
    if (m[3] !== undefined) {
      out.push(
        <code key={key++} className="rounded bg-bg-raised px-1 text-[0.9em]">
          {m[3]}
        </code>
      );
    } else {
      out.push(
        <strong key={key++} className="font-semibold">
          {m[1] ?? m[2]}
        </strong>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(plain(text.slice(last)));
  return out;
}

export function CoachText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className={`space-y-1.5 break-words text-sm leading-relaxed ${className}`}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const indent = (line.match(/^\s*/)?.[0].length ?? 0) >= 2 ? "ml-4" : "";

        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) return <p key={i} className="font-semibold">{inline(heading[1])}</p>;

        const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (num) {
          return (
            <p key={i} className={`flex gap-2 ${indent}`}>
              <span className="shrink-0 text-text-muted">{num[1]}.</span>
              <span className="min-w-0">{inline(num[2])}</span>
            </p>
          );
        }

        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={i} className={`flex gap-2 ${indent}`}>
              <span className="shrink-0 text-text-muted">•</span>
              <span className="min-w-0">{inline(bullet[1])}</span>
            </p>
          );
        }

        return <p key={i} className={indent}>{inline(line)}</p>;
      })}
    </div>
  );
}
