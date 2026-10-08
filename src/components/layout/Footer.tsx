import { Link } from "react-router-dom";
import { SITE, LEGAL_LINKS, copyrightYears } from "@/lib/siteConfig";

const linkCls =
  "rounded text-sm text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface";

// Persistent footer rendered by AppShell on every page. Sits in normal document
// flow (no position: fixed). Long-form policy text lives on the legal pages, so
// the footer only carries: brand + one-line blurb, legal links, and a single
// copyright / non-affiliation line.
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-surface px-4 pb-24 pt-8 lg:px-6 lg:pb-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-12">
          <section aria-labelledby="footer-about" className="space-y-2 lg:col-span-7">
            <div className="flex items-center gap-2.5">
              <img src="/logo-64.webp" alt="" width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 shrink-0" />
              <div>
                <h2 id="footer-about" className="font-display text-base font-semibold leading-tight">
                  {SITE.name}
                </h2>
                <p className="text-xs text-text-muted">{SITE.taglineEn}</p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-text-muted">
              เว็บไซต์ชุมชนและเครื่องมือช่วยวิเคราะห์ข้อมูลสำหรับเกม RoV (Arena of Valor)
              ใช้ประกอบการตัดสินใจเท่านั้น ข้อมูลอาจเปลี่ยนแปลงตามการอัปเดตของเกม
            </p>
          </section>

          <nav aria-label="Legal" className="lg:col-span-5">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
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

        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-text-muted">
          © {copyrightYears()} {SITE.name}. Independent community project — not affiliated with or
          endorsed by Garena or the respective copyright and trademark owners. ข้อมูลเป็นการวิเคราะห์
          ไม่รับประกันความถูกต้องหรือผลการแข่งขัน
        </p>
      </div>
    </footer>
  );
}
