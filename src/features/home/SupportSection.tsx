import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { KOFI_URL } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";
import { getPublicSponsors, type PublicSponsor } from "@/services/publicSponsors";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const card = "flex flex-col justify-between gap-4 rounded-card border border-border bg-bg-surface p-4";
const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors";

// Small, visually secondary blocks at the very bottom of Home (before the shared Footer):
// active sponsors (managed in /admin, only shown when there is at least one), voluntary donation (Ko-fi) and, separately,
// commercial sponsor inquiries (goes to /contact with the advertising topic).
// No payment logic, no tracking scripts, no fake sponsors.
export function SupportSection() {
  const [sponsors, setSponsors] = useState<PublicSponsor[]>([]);

  useEffect(() => {
    let alive = true;
    void getPublicSponsors().then((s) => {
      if (alive) setSponsors(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-label="สนับสนุนและผู้สนับสนุน" className="grid gap-3 md:grid-cols-2">
      {sponsors.length > 0 && (
        <div className="space-y-2 md:col-span-2">
          <p className="text-xs font-medium tracking-wide text-text-faint">ผู้สนับสนุน</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((s) => (
              <li key={s.id}>
                <a
                  href={s.link_url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-card border border-border bg-bg-surface p-3 transition-colors hover:border-accent/50",
                    FOCUS
                  )}
                >
                  {s.logo_url && (
                    <img
                      src={s.logo_url}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 rounded-lg bg-bg-raised object-contain"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold">{s.name}</span>
                    {s.tagline && <span className="line-clamp-2 block text-xs text-text-muted">{s.tagline}</span>}
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
                  <span className="sr-only">(เปิดในแท็บใหม่)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

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
