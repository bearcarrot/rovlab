import { Link } from "react-router-dom";
import { SITE, LEGAL_LINKS, copyrightYears } from "@/lib/siteConfig";

const linkCls =
  "rounded text-sm text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface";

// Persistent footer rendered by AppShell on every page. Sits in normal document
// flow (no position: fixed). Long-form policy text lives on the legal pages.
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-surface px-4 pb-24 pt-8 lg:px-6 lg:pb-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-12">
          <section aria-labelledby="footer-about" className="space-y-3 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
              <div>
                <h2 id="footer-about" className="font-display text-base font-semibold leading-tight">
                  {SITE.name}
                </h2>
                <p className="text-xs text-text-muted">{SITE.taglineEn}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              {SITE.name} เป็นเว็บไซต์ชุมชนและเครื่องมือช่วยวิเคราะห์ข้อมูลสำหรับเกม RoV (Arena of Valor)
              รวบรวมข้อมูลฮีโร่ ไอเทม รูน Tier และข้อมูลประกอบการวางแผนการเล่น
              เพื่อใช้เป็นเครื่องมือช่วยประกอบการตัดสินใจ ไม่ใช่ระบบที่รับประกันผลการแข่งขัน
              {" "}
              {SITE.name} เป็นโปรเจกต์อิสระ ไม่ใช่เว็บไซต์ทางการของเกมหรือผู้ให้บริการเกม
            </p>
          </section>

          <section aria-labelledby="footer-data" className="space-y-3 lg:col-span-4">
            <h2 id="footer-data" className="font-display text-sm font-semibold">
              Data &amp; Sources
            </h2>
            <p className="text-sm leading-relaxed text-text-muted">
              เราใช้แหล่งข้อมูลสาธารณะหลายแหล่งเพื่อรวบรวมและตรวจสอบข้อมูล
              โดยข้อมูลอาจมีการเปลี่ยนแปลงตามการอัปเดตของเกม
            </p>
            <Link to="/data-sources" className={linkCls}>
              ดูแหล่งอ้างอิงข้อมูล
            </Link>
          </section>

          <nav aria-labelledby="footer-legal" className="space-y-3 lg:col-span-3">
            <h2 id="footer-legal" className="font-display text-sm font-semibold">
              Legal
            </h2>
            <ul className="space-y-2">
              {LEGAL_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={linkCls}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-text-muted">
          Disclaimer: ข้อมูล Tier, Counter, Synergy และ Build เป็นการวิเคราะห์จากข้อมูลที่ระบบมี
          ไม่รับประกันความถูกต้อง 100% หรือผลการแข่งขัน โปรดตรวจสอบกับแหล่งข้อมูลต้นทางเมื่อจำเป็น{" "}
          <Link to="/disclaimer" className="underline underline-offset-4 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
            อ่านเพิ่มเติม
          </Link>
        </p>

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-xs text-text-muted sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p>
              © {copyrightYears()} {SITE.name}. Independent community project.
            </p>
            <p>
              {SITE.name} is not affiliated with or endorsed by Garena or the respective copyright and
              trademark owners.
            </p>
          </div>
          <p className="shrink-0">Data is updated periodically</p>
        </div>
      </div>
    </footer>
  );
}
