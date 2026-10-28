import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { validateEmail } from "@/features/auth/email";
import { useCooldown } from "@/features/auth/useCooldown";
import { inputCls, outlineBtnCls, primaryBtnCls } from "@/features/auth/styles";
import { SITE } from "@/lib/siteConfig";
import {
  CONTACT_TOPICS,
  MAX_MESSAGE,
  MAX_NAME,
  MIN_MESSAGE,
  submitContactMessage,
  topicFromParam,
  type ContactTopic,
} from "@/services/contact";

const labelCls = "block space-y-1.5 text-sm font-medium";
const inlineLink = "underline underline-offset-4 hover:text-text";

// หน้าติดต่อเรา: ฟอร์มส่งข้อความ (ผู้ใช้ทั่วไปส่งได้โดยไม่ต้องล็อกอิน) + อีเมลสำรอง
export function Contact() {
  const { user, isConfigured } = useAuth();
  const [params] = useSearchParams();
  const cooldown = useCooldown("contact", 60);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // ?topic=advertising (จากปุ่ม "สนใจลงโฆษณา" ในหน้าแรก) เลือกหัวข้อให้ล่วงหน้า
  const [topic, setTopic] = useState<ContactTopic>(() => topicFromParam(params.get("topic")));
  const [message, setMessage] = useState("");
  // honeypot: คนจริงมองไม่เห็นและไม่กรอก บอทที่กรอกทุกช่องจะถูกข้ามแบบเงียบ ๆ
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // เติมอีเมล/ชื่อให้สมาชิกครั้งเดียว (ไม่ทับสิ่งที่พิมพ์ไปแล้ว)
  useEffect(() => {
    if (!user) return;
    setEmail((v) => v || user.email || "");
    const meta = user.user_metadata?.display_name;
    if (typeof meta === "string") setName((v) => v || meta.slice(0, MAX_NAME));
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown.remaining > 0) return;
    setError(null);
    if (!name.trim()) return setError("กรุณากรอกชื่อ");
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    if (message.trim().length < MIN_MESSAGE) return setError(`ข้อความต้องยาวอย่างน้อย ${MIN_MESSAGE} ตัวอักษร`);
    if (website) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      await submitContactMessage({ name, email, topic, message });
      cooldown.start();
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-semibold">ติดต่อเรา</h1>
        <p className="text-sm text-text-muted">
          ส่งคำถาม ข้อเสนอแนะ หรือแจ้งปัญหาถึงทีมงาน {SITE.name} เราจะตอบกลับทางอีเมลที่คุณกรอก
        </p>
      </header>

      {sent ? (
        <section
          role="status"
          className="space-y-3 rounded-card border border-border bg-bg-surface p-5 text-center shadow-card"
        >
          <CheckCircle2 className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold">ส่งข้อความเรียบร้อยแล้ว</h2>
          <p className="text-sm text-text-muted">ขอบคุณที่ติดต่อมา เราจะตอบกลับทางอีเมลโดยเร็วที่สุด</p>
          <button type="button" onClick={() => setSent(false)} className={`${outlineBtnCls} mx-auto max-w-xs`}>
            ส่งข้อความอีกครั้ง
          </button>
        </section>
      ) : !isConfigured ? (
        <section className="rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted shadow-card">
          ฟอร์มยังไม่พร้อมใช้งานในขณะนี้
          {SITE.contactEmail && (
            <>
              {" "}
              ส่งอีเมลหาเราได้ที่{" "}
              <a className={inlineLink} href={`mailto:${SITE.contactEmail}`}>
                {SITE.contactEmail}
              </a>
            </>
          )}
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-card border border-border bg-bg-surface p-4 shadow-card"
        >
          <label className={labelCls}>
            <span>ชื่อ</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={MAX_NAME}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className={labelCls}>
            <span>อีเมลสำหรับตอบกลับ</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className={labelCls}>
            <span>หัวข้อ</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)} className={inputCls}>
              {CONTACT_TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            <span>ข้อความ</span>
            <textarea
              rows={6}
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={topic === "advertising" ? "แนะนำแบรนด์ รูปแบบที่สนใจ และช่วงเวลาที่ต้องการ" : undefined}
              className={`${inputCls} min-h-[140px] resize-y`}
            />
            <span className="block text-right text-xs font-normal text-text-faint">
              {message.length}/{MAX_MESSAGE}
            </span>
          </label>

          {/* honeypot — ซ่อนจากผู้ใช้และ screen reader */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || cooldown.remaining > 0} className={primaryBtnCls}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy
              ? "กำลังส่ง…"
              : cooldown.remaining > 0
                ? `ส่งอีกครั้งได้ใน ${cooldown.remaining} วินาที`
                : "ส่งข้อความ"}
          </button>

          <p className="text-xs leading-relaxed text-text-faint">
            เราใช้ชื่อ อีเมล และข้อความของคุณเพื่อตอบกลับเท่านั้น ดูรายละเอียดที่{" "}
            <Link className={inlineLink} to="/privacy">
              Privacy Policy
            </Link>
          </p>
        </form>
      )}

      {SITE.contactEmail && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          หรือส่งอีเมลหาเราโดยตรงที่{" "}
          <a className={`${inlineLink} break-all`} href={`mailto:${SITE.contactEmail}`}>
            {SITE.contactEmail}
          </a>
        </p>
      )}
    </div>
  );
}
