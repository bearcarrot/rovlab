import { Link } from "react-router-dom";
import { ExternalLink, Megaphone } from "lucide-react";
import { KOFI_URL } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const card = "flex flex-col justify-between gap-4 rounded-card border border-border bg-bg-surface p-4";
const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors";

// Two small, visually secondary blocks at the very bottom of Home (before the shared Footer):
// voluntary donation (Ko-fi) and, separately, commercial sponsor inquiries (goes to /contact with the advertising topic).
// No payment logic, no tracking scripts, no fake sponsors.
export function SupportSection() {
  return (
    <section aria-label="สนับสนุนและผู้สนับสนุน" className="grid gap-3 md:grid-cols-2">
      {KOFI_URL && (
        <div className={card}>
          <div className="space-y-1.5">
            <h2 className="font-display text-base font-semibold">ช่วยให้ RoV LAB พัฒนาต่อไป ❤️</h2>
            <p className="text-sm leading-relaxed text-text-muted">
              RoV LAB ตั้งใจพัฒนาเครื่องมือสำหรับชุมชน RoV ให้ทุกคนใช้งานได้ฟรี หากคุณชอบเว็บไซต์นี้
              สามารถร่วมสนับสนุนค่าเซิร์ฟเวอร์และการพัฒนาฟีเจอร์ใหม่ ๆ ได้ตามความสมัครใจ
            </p>
            <p className="text-xs text-text-faint">
              การสนับสนุนเป็นไปตามความสมัครใจ ไม่มีสิทธิพิเศษหรือฟีเจอร์เพิ่มเติม
            </p>
          </div>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(btnBase, "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15", FOCUS)}
          >
            สนับสนุนผ่าน Ko-fi <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(เปิดในแท็บใหม่)</span>
          </a>
        </div>
      )}

      <div className={card}>
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold">พื้นที่สำหรับผู้สนับสนุน</h2>
          <p className="text-sm leading-relaxed text-text-muted">สนใจประชาสัมพันธ์แบรนด์กับชุมชน RoV ติดต่อเราได้</p>
          <p className="text-xs text-text-faint">ส่วนนี้สำหรับการโฆษณาเชิงพาณิชย์ แยกจากการบริจาคผ่าน Ko-fi</p>
        </div>
        <Link
          to="/contact?topic=advertising"
          className={cn(btnBase, "border-border bg-bg-raised text-text hover:border-accent/50", FOCUS)}
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" /> สนใจลงโฆษณา
        </Link>
      </div>
    </section>
  );
}
