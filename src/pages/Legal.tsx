import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SITE } from "@/lib/siteConfig";

function LegalLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        {intro && <p className="text-sm text-text-muted">{intro}</p>}
      </header>
      {children}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-card border border-border bg-bg-surface p-4 shadow-card">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

// Structure-only page for policies whose full text is still being drafted.
function PendingPage({ title, topics }: { title: string; topics: string[] }) {
  return (
    <LegalLayout title={title}>
      <Section title="สถานะ">
        <p>เนื้อหาฉบับสมบูรณ์อยู่ระหว่างจัดทำ หน้านี้เตรียมโครงสร้างไว้สำหรับเพิ่มเนื้อหาภายหลัง</p>
      </Section>
      <Section title="หัวข้อที่จะครอบคลุม">
        <Bullets items={topics} />
      </Section>
    </LegalLayout>
  );
}

export function PrivacyPolicy() {
  return (
    <PendingPage
      title="Privacy Policy"
      topics={[
        "ข้อมูลที่เก็บรวบรวม (บัญชีผู้ใช้ รายการโปรด บิลด์/ดราฟต์ที่บันทึก ความคิดเห็น)",
        "วัตถุประสงค์ในการใช้ข้อมูล",
        "บริการของบุคคลที่สาม (เช่น การเข้าสู่ระบบ)",
        "การจัดเก็บและความปลอดภัยของข้อมูล",
        "สิทธิของผู้ใช้และช่องทางติดต่อ",
      ]}
    />
  );
}

export function TermsOfUse() {
  return (
    <PendingPage
      title="Terms of Use"
      topics={[
        "ขอบเขตการให้บริการ",
        "การใช้งานที่ยอมรับได้",
        "เนื้อหาที่ผู้ใช้สร้าง",
        "ข้อจำกัดความรับผิด",
        "การเปลี่ยนแปลงข้อกำหนด",
      ]}
    />
  );
}

export function CommunityGuidelines() {
  return (
    <PendingPage
      title="Community Guidelines"
      topics={[
        "แนวทางการแสดงความคิดเห็น",
        "เนื้อหาที่ไม่อนุญาต",
        "การรายงานและการดำเนินการกับเนื้อหา",
      ]}
    />
  );
}

export function Disclaimer() {
  return (
    <LegalLayout title="Disclaimer">
      <Section title="โปรเจกต์อิสระ">
        <p>
          {SITE.name} เป็นโปรเจกต์อิสระ ไม่ใช่เว็บไซต์ แอป หรือบริการอย่างเป็นทางการของ Garena
          หรือเจ้าของลิขสิทธิ์เกม
        </p>
        <p>
          ชื่อ โลโก้ ตัวละคร ภาพ ไอคอน และทรัพย์สินทางปัญญาที่เกี่ยวข้องกับเกม
          ยังคงเป็นของเจ้าของสิทธิ์ที่เกี่ยวข้อง
        </p>
      </Section>
      <Section title="ความถูกต้องของข้อมูล">
        <Bullets
          items={[
            `${SITE.name} ไม่รับประกันว่าข้อมูลจะถูกต้อง 100% หรือเป็นข้อมูลล่าสุดเสมอ`,
            "ข้อมูลอาจเปลี่ยนแปลงตาม Patch / Update ของเกม",
            "ผู้ใช้ควรตรวจสอบข้อมูลกับแหล่งข้อมูลต้นทางเมื่อจำเป็น",
          ]}
        />
      </Section>
      <Section title="คำแนะนำเชิงวิเคราะห์">
        <p>
          Tier, Counter, Synergy, Build หรือคำแนะนำต่าง ๆ เป็นข้อมูลเชิงวิเคราะห์/ความคิดเห็นจากข้อมูลที่ระบบมี
          ไม่ควรถือเป็นคำแนะนำที่รับประกันผลการแข่งขัน
        </p>
        <p>
          ดูที่มาของข้อมูลได้ที่ <Link className="underline underline-offset-4 hover:text-text" to="/data-sources">Data Sources</Link>
        </p>
      </Section>
    </LegalLayout>
  );
}

export function DataSources() {
  return (
    <LegalLayout
      title="Data Sources"
      intro="เราใช้แหล่งข้อมูลสาธารณะหลายแหล่งเพื่อรวบรวมและตรวจสอบข้อมูล โดยข้อมูลอาจมีการเปลี่ยนแปลงตามการอัปเดตของเกม"
    >
      <Section title="ประเภทแหล่งข้อมูล">
        <p>ข้อมูลในเว็บไซต์อาจมาจากหลายแหล่ง เช่น</p>
        <Bullets
          items={[
            "ข้อมูลเกมและข้อมูลสาธารณะที่เผยแพร่โดยผู้ให้บริการเกม",
            "เว็บไซต์/ฐานข้อมูล RoV ที่เผยแพร่ข้อมูลต่อสาธารณะ",
            `ข้อมูลที่รวบรวมและจัดโครงสร้างโดยทีมพัฒนา ${SITE.name}`,
            "ข้อมูลจากชุมชนหรือผู้เล่น",
            `ข้อมูลที่คำนวณหรือประมวลผลโดยระบบของ ${SITE.name}`,
          ]}
        />
      </Section>
      <Section title="ข้อมูลต้นฉบับ vs ข้อมูลที่วิเคราะห์เอง">
        <p>
          Build และ Matchup แต่ละรายการระบุที่มาในระบบเป็น “curated” (เรียบเรียงโดยทีมงาน) หรือ
          “heuristic” (ประมวลผลโดยระบบ) ส่วน Tier, Counter และ Synergy เป็นข้อมูลเชิงวิเคราะห์
          ไม่ใช่ข้อมูลต้นฉบับจากผู้ให้บริการเกม
        </p>
      </Section>
      <Section title="ลิงก์อ้างอิงต้นทาง">
        <p>
          ขณะนี้ยังไม่ได้แสดงลิงก์ต้นทางรายรายการ จะเพิ่มเมื่อระบบมีข้อมูลแหล่งที่มาสำหรับรายการนั้น ๆ
        </p>
      </Section>
    </LegalLayout>
  );
}
