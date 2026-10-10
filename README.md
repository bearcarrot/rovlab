# RoV LAB

**เครื่องมือวิเคราะห์ RoV สำหรับการเลือกฮีโร่, Counter Pick และ Draft**  
RoV LAB รวมข้อมูลฮีโร่ สถิติ ความสัมพันธ์ระหว่างฮีโร่ และเครื่องมือวางแผนดราฟไว้ในเว็บเดียว โดยให้ความสำคัญกับข้อมูลที่ตรวจสอบได้และคำแนะนำที่อธิบายเหตุผลได้

<p align="center">
  <a href="https://rovlab.vercel.app"><strong>เปิดใช้งาน RoV LAB</strong></a>
  ·
  <a href="https://github.com/bearcarrot/rovlab">Source Code</a>
</p>

> **สถานะ:** กำลังพัฒนาและปรับปรุงคุณภาพก่อน Release  
> RoV LAB เป็นโปรเจกต์ชุมชนที่ไม่ใช่เว็บไซต์หรือบริการอย่างเป็นทางการของผู้พัฒนา/ผู้ให้บริการเกม RoV

---

## สารบัญ

- [ภาพรวม](#ภาพรวม)
- [ฟีเจอร์](#ฟีเจอร์)
- [หลักการด้านข้อมูล](#หลักการด้านข้อมูล)
- [เทคโนโลยี](#เทคโนโลยี)
- [เริ่มต้นพัฒนา](#เริ่มต้นพัฒนา)
- [Environment Variables](#environment-variables)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [ประสิทธิภาพและการเข้าถึง](#ประสิทธิภาพและการเข้าถึง)
- [ความปลอดภัย](#ความปลอดภัย)
- [แนวทางการพัฒนา](#แนวทางการพัฒนา)
- [ข้อจำกัดและแผนงาน](#ข้อจำกัดและแผนงาน)
- [กฎหมายและแหล่งข้อมูล](#กฎหมายและแหล่งข้อมูล)

---

## ภาพรวม

RoV LAB ช่วยให้ผู้เล่นตอบคำถามระหว่างเตรียมทีมและ Draft เช่น

- ฮีโร่ตัวไหนเหมาะกับ Role หรือ Lane ที่ต้องการ?
- ควรเลือกฮีโร่อะไรเพื่อรับมือกับทีมศัตรู?
- Matchup ระหว่างฮีโร่มีข้อมูลสนับสนุนแบบใด?
- ทีมขาด Role หรือองค์ประกอบอะไร?
- Draft ปัจจุบันสมดุลแค่ไหน และควรเลือกตัวต่อไปอย่างไร?
- จะจัดเก็บและแชร์ Draft หรือ Tier List ของตัวเองได้อย่างไร?

เป้าหมายไม่ใช่แค่รวบรวมรายชื่อฮีโร่ แต่เชื่อมข้อมูลเข้ากับการตัดสินใจในเกมจริง

## ฟีเจอร์

### Hero Database

- รายการฮีโร่และหน้ารายละเอียด
- ค้นหาและกรองตาม Role / Lane
- ภาพฮีโร่และข้อมูลสกิลตามข้อมูลที่มีในระบบ
- เชื่อมข้อมูลฮีโร่กับสถิติ, Tier List, Counter Pick, Matchup และ Draft

### Tier List

- ดู Tier List และกรองตามเงื่อนไขที่ระบบรองรับ
- สร้างและจัดการ Tier List ส่วนตัว
- เผยแพร่ Tier List ให้ชุมชนดู
- โหลด Tier List ของผู้อื่นเป็นสำเนา แทนการแก้ไขต้นฉบับ
- สร้างภาพสำหรับแชร์ Tier List

### Counter Pick และ Matchup

- ค้นหาตัวเลือกจากฮีโร่ฝั่งตรงข้าม
- ดูความสัมพันธ์ Counter และข้อมูล Matchup ที่มีในฐานข้อมูล
- ใช้ Role, Lane และข้อมูลที่เกี่ยวข้องช่วยประกอบการตัดสินใจ

**ข้อสำคัญ:** Overall Win Rate ไม่ใช่สถิติชนะเมื่อเจอกันโดยตรง (Head-to-Head Win Rate) หากไม่มีข้อมูล Matchup โดยตรง ระบบไม่ควรนำ Overall Win Rate มาแสดงแทน

### Draft Assistant

- วางแผน Pick / Ban ของทั้งสองทีม
- ใช้ข้อมูลฮีโร่, Counter, Synergy, Role, Lane และ Tier ที่มีอยู่เพื่อประกอบคำแนะนำ
- รองรับการจัด Draft แบบ Series เช่น Single Game และ Best of 3 / 5 / 7
- รองรับแนวคิด Global Ban Pick สำหรับ Draft Series
- แสดงข้อมูลประกอบคำแนะนำ เพื่อให้ผู้เล่นเข้าใจเหตุผลมากกว่าคะแนนเพียงอย่างเดียว

ผลการแนะนำขึ้นอยู่กับความครบถ้วนและคุณภาพของข้อมูลในฐานข้อมูล ไม่ใช่การรับประกันผลการแข่งขัน

### My Draft และ Community Draft

- บันทึก แก้ไข ทำสำเนา และลบ Draft ของตัวเอง
- เลือกเผยแพร่แบบ Public หรือเก็บเป็น Private ตามฟีเจอร์ที่เปิดใช้งาน
- เรียกดู Draft ของชุมชน ค้นหา และเรียงรายการ
- ใช้ Draft ที่เผยแพร่เป็น Preset / สำเนา เพื่อไม่เปลี่ยนต้นฉบับของผู้สร้าง
- รองรับข้อมูลผู้สร้าง คำอธิบาย และการโต้ตอบกับเนื้อหาในชุมชน

### Statistics

- ดูสถิติฮีโร่ เช่น Win Rate, Pick Rate และ Ban Rate เมื่อมีข้อมูลจริง
- กรองตาม Rank, Role หรือ Lane ตามข้อมูลที่รองรับ
- แสดงข้อมูล Patch / ช่วง Rank เมื่อมีข้อมูลกำกับ

### Coach AI

Coach AI ช่วยอธิบายสถานการณ์ Draft โดยใช้ Context จากระบบ เช่น ฮีโร่ของทั้งสองทีม, สกิล, Counter และองค์ประกอบทีม

ระบบควรอ้างอิงข้อมูลที่ส่งให้จริง และแจ้งเมื่อข้อมูลไม่เพียงพอ แทนการแต่งชื่อสกิล ตัวเลข หรือสถิติขึ้นมาเอง

### บัญชีผู้ใช้และ Community

- สมัครสมาชิก / เข้าสู่ระบบ
- ยืนยันอีเมลและกู้คืนรหัสผ่าน
- โปรไฟล์และหน้าโปรไฟล์สาธารณะ
- Favorites, Feed และ Notifications
- ความสามารถด้าน Follow, Comments, Replies, Mentions และ Reactions ตามส่วนที่เปิดใช้งาน
- หน้า Admin สำหรับการดูแลระบบและเนื้อหา โดยต้องมีการตรวจสิทธิ์

### UI และการแชร์

- ออกแบบให้ใช้งานได้ทั้งมือถือและเดสก์ท็อป
- ปุ่มและพื้นที่กดคำนึงถึงการใช้งานบนหน้าจอสัมผัส
- Share Image สำหรับเนื้อหาที่รองรับ
- มีหน้า Legal และข้อมูลแหล่งที่มา

> รายการข้างต้นอธิบายขอบเขตฟีเจอร์ของโปรเจกต์ ไม่ได้หมายความว่าทุกฟีเจอร์ผ่าน QA หรือพร้อมใช้งานสมบูรณ์ในทุกสภาพแวดล้อมแล้ว

---

## หลักการด้านข้อมูล

RoV LAB ยึดหลัก **Reliable Data → Explainable Analysis → Better Decisions**

### สิ่งที่ต้องหลีกเลี่ยง

- ห้ามสร้าง Win Rate, Pick Rate หรือ Ban Rate ขึ้นมาเอง
- ห้ามสร้างสถิติ Head-to-Head, Counter หรือ Synergy แล้วนำเสนอเหมือนเป็นข้อมูลจริง
- ห้ามใช้ Overall Win Rate แทน Head-to-Head Win Rate
- ห้ามแสดง Placeholder ที่ทำให้ผู้ใช้เข้าใจว่ามีข้อมูลจริง
- ห้ามนำ Heuristic ไปแสดงเสมือนเป็นสถิติจากเกม

### แนวทางที่ควรทำ

- เก็บ Source และ Source URL เมื่อทำได้
- แยกข้อมูลจริงออกจากการประเมินหรือ Heuristic
- แสดงเฉพาะข้อมูลที่มีและระบุข้อจำกัดให้ชัดเจน
- ตรวจสอบข้อมูลซ้ำ ความสัมพันธ์ย้อนกลับ และความสอดคล้องของข้อมูล
- เมื่อข้อมูลไม่เพียงพอ ให้แสดงสถานะว่าไม่มีข้อมูล แทนการคาดเดา

### Item, Rune และ Enchantment

RoV LAB ไม่ได้ตั้งเป้าแข่งขันกับ Preset ภายในเกม หากเกมมี Preset จาก Top Server ที่อัปเดตได้ตรงกับ Meta มากกว่า ควรใช้แหล่งข้อมูลที่เชื่อถือได้แทนการสร้าง Build recommendation แบบ Hard-code โดยไม่มีหลักฐานรองรับ

ฐานข้อมูล Item / Rune ที่มีอยู่สามารถใช้เป็นข้อมูลอ้างอิงประกอบฟีเจอร์อื่นได้ แต่ไม่ควรตีความว่าเป็น Preset แนะนำที่อัปเดตตาม Meta โดยอัตโนมัติ

---

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18, TypeScript |
| Build Tool | Vite |
| Routing | React Router |
| Styling | Tailwind CSS |
| UI Components | Radix UI และ shadcn/ui-style components |
| Icons | Lucide React |
| Backend / Database | Supabase, PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Row Level Security (RLS), database functions / RPC |
| Deployment | Vercel |
| Source Control | GitHub |

---

## เริ่มต้นพัฒนา

### ความต้องการเบื้องต้น

- Node.js รุ่นที่รองรับกับ Vite ในโปรเจกต์
- npm
- Supabase Project สำหรับเปิดใช้ข้อมูลและฟีเจอร์ที่เชื่อมต่อ Supabase

### ติดตั้ง

```bash
git clone https://github.com/bearcarrot/rovlab.git
cd rovlab
npm install
```

สร้างไฟล์ `.env` ที่ Root ของโปรเจกต์ แล้วกำหนดค่าตามหัวข้อ [Environment Variables](#environment-variables)

เริ่ม Development Server:

```bash
npm run dev
```

Vite จะแสดง URL สำหรับเปิดเว็บในเครื่อง โดยปกติคือ `http://localhost:5173`

### Build และตรวจสอบ

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

`npm run build` จะ build ด้วย Vite และรัน `scripts/prerender-meta.mjs` ต่อท้ายเพื่อจัดการ Meta ของหน้าที่รองรับ

---

## Environment Variables

ตัวแปรฝั่ง Frontend ที่ใช้เชื่อมต่อ Supabase:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

นำค่าจริงจาก Supabase Project ของคุณมาใส่ ห้าม Commit ไฟล์ `.env` ที่มีค่าลับลง Git

- `VITE_SUPABASE_URL` คือ URL ของ Supabase Project
- `VITE_SUPABASE_ANON_KEY` คือ Publishable/Anon key ที่ออกแบบมาสำหรับ Client

**ห้ามใส่ `service_role` key, database password หรือ Secret สำหรับฝั่ง Server ในตัวแปร `VITE_*`** เพราะค่าที่มี Prefix นี้จะถูกส่งไปยัง Client Bundle ได้

หากไม่ได้ตั้งค่าตัวแปร Supabase โค้ด Client ปัจจุบันมี Dummy Client เพื่อให้บางส่วนของแอปแสดงสถานะ “ยังไม่ได้ตั้งค่า” แทนการ Crash แต่ฟีเจอร์ที่ต้องใช้ Supabase จะไม่ทำงานตามปกติ

การตั้งค่า Redirect URL, Google OAuth, Email verification และ Password Reset ต้องสอดคล้องกับ URL ของ Local Development และ Production ใน Supabase Auth

---

## ประสิทธิภาพและการเข้าถึง

โปรเจกต์มีการทำงานด้าน Performance และ Mobile UX อย่างต่อเนื่อง โดยแนวทางสำคัญ ได้แก่

- โหลดหน้า Home แบบ Eager เพื่อลดความล่าช้าของเนื้อหาส่วนแรก
- ใช้ Route-level Code Splitting สำหรับหน้าที่ไม่ใช่หน้าแรก
- Prefetch ข้อมูลที่หลายหน้าต้องใช้ และใช้ Cache ของ Request ที่กำลังทำงานร่วมกันเพื่อลดการเรียกซ้ำ
- ปรับลำดับ Supabase Requests เพื่อลด Network Dependency Chain
- ปรับขนาดและการโหลดรูปภาพที่มีผลต่อ LCP
- ปรับ Skeleton ให้ใกล้เคียงกับขนาดเนื้อหาจริง เพื่อลด Layout Shift
- ใช้ขนาดตัวอักษรและพื้นที่กดที่เหมาะกับมือถือ โดยเฉพาะ iOS Safari
- ตรวจสอบ Database Indexes และ RLS Policies เพื่อหลีกเลี่ยง Query ที่ไม่จำเป็น

Performance เป็นงานที่ต้องวัดผลจริงต่อเนื่อง ไม่ควรถือว่าการเปลี่ยนโค้ดเพียงอย่างเดียวรับประกันคะแนน PageSpeed Insights หรือ Lighthouse

หลังแก้ไขหน้าแรกหรือเส้นทางสำคัญ ควรทดสอบทั้ง Mobile และ Desktop รวมถึงตรวจ LCP, CLS, จำนวน Network Requests และ Console Errors

---

## ความปลอดภัย

แนวทางความปลอดภัยของโปรเจกต์:

- ใช้ Supabase Auth สำหรับระบบบัญชี
- บังคับใช้ RLS กับตารางที่มีข้อมูลผู้ใช้หรือข้อมูลที่ต้องจำกัดสิทธิ์
- ตรวจสิทธิ์ Admin ที่ฝั่ง Server / Database ด้วย ไม่พึ่งการซ่อน UI อย่างเดียว
- ตรวจสอบสิทธิ์การเรียก RPC และฟังก์ชันที่มีสิทธิ์สูง
- กำหนด `search_path` อย่างปลอดภัยสำหรับฟังก์ชันที่เกี่ยวข้อง
- แยกข้อมูล Public ออกจากข้อมูล Private ให้ชัดเจน
- ใช้ Security Headers และ Content Security Policy ตามความเหมาะสม
- จำกัดการใช้งาน AI Coach ตามนโยบายของระบบ
- หลีกเลี่ยงการปิด RLS หรือขยายสิทธิ์กว้างเกินจำเป็นเพื่อให้ฟีเจอร์ทำงานได้

การแก้ Schema หรือ Policy ควรตรวจสอบผลกระทบต่อฟีเจอร์เดิมก่อนเสมอ โดยเฉพาะข้อมูล Gameplay ที่ตั้งใจให้ผู้ใช้ทั่วไปอ่านได้

---

## แนวทางการพัฒนา

ก่อนแก้ฟีเจอร์:

1. อ่าน Implementation ปัจจุบันและตรวจว่าฟีเจอร์ถูกใช้ที่ใดบ้าง
2. ตรวจ Schema, RLS, RPC และ Migration ที่เกี่ยวข้อง
3. ตรวจ Pull Request และประวัติการเปลี่ยนแปลงที่เกี่ยวข้อง
4. แก้เฉพาะ Scope ที่จำเป็น และหลีกเลี่ยง Breaking Changes
5. อย่าลบหรือเปลี่ยนข้อมูลโดยไม่มีแผนสำรอง
6. อย่าปิด Security เพื่อให้ Test ผ่าน
7. อย่าสร้าง Gameplay Data ที่ไม่มี Source
8. รักษา Performance ของหน้าแรกและหน้าที่มีผู้ใช้เข้าชมบ่อย
9. ทดสอบ TypeScript, Lint, Build และหน้าที่ได้รับผลกระทบ
10. ตรวจทั้งมือถือและเดสก์ท็อปก่อน Merge

### Pull Requests ที่เกี่ยวข้องกับงานล่าสุด

ประวัติ PR ช่วงล่าสุดมีการปรับปรุงในหัวข้อเหล่านี้:

- [#141 — Rename arcana to rune](https://github.com/bearcarrot/rovlab/pull/141)
- [#140 — Draft tier balance badge](https://github.com/bearcarrot/rovlab/pull/140)
- [#139 — Rename arcana to rune (migration, items service, admin build slots)](https://github.com/bearcarrot/rovlab/pull/139)
- [#138 — HeroCard typography](https://github.com/bearcarrot/rovlab/pull/138)
- [#137 — Heroes tile cards](https://github.com/bearcarrot/rovlab/pull/137)
- [#136 — Draft global ban UI](https://github.com/bearcarrot/rovlab/pull/136)
- [#134 — Home Supabase request-chain / prefetch optimization](https://github.com/bearcarrot/rovlab/pull/134)
- [#128 — PageSpeed, accessibility และ Mobile UX fixes](https://github.com/bearcarrot/rovlab/pull/128)

ตรวจสถานะและรายละเอียดล่าสุดของแต่ละ PR ใน GitHub ก่อนใช้เป็นหลักฐานว่าโค้ดถูก Merge และ Deploy แล้ว

---

## ข้อจำกัดและแผนงาน

ลำดับความสำคัญในการพัฒนาควรเน้นคุณภาพของระบบที่มีอยู่ มากกว่าการเพิ่มฟีเจอร์โดยไม่ตรวจความพร้อม:

1. **Data Quality** — ตรวจสอบ Source, ความครบถ้วน และความสัมพันธ์ของข้อมูล
2. **Draft / Counter / Matchup / Synergy** — ให้คำแนะนำตรงกับข้อมูลและอธิบายได้
3. **Community** — ทำให้ Draft และ Tier List ที่แชร์ทำงานอย่างปลอดภัยและไม่แก้ต้นฉบับ
4. **Auth & Security** — ตรวจ RLS, RPC และสิทธิ์ Admin
5. **Performance** — วัดผล PageSpeed/Lighthouse และป้องกัน Regression
6. **QA & Release** — ตรวจเส้นทางสำคัญบนมือถือและเดสก์ท็อป

### Item Build

หน้า `/build` ถูก Redirect ไปหน้าแรกแล้วใน Routing ปัจจุบัน จึงไม่ใช่ Product Priority หลัก ข้อมูล Item / Rune ที่มีอยู่ยังใช้เป็น Reference สำหรับระบบอื่นได้

---

## กฎหมายและแหล่งข้อมูล

RoV LAB เป็นโปรเจกต์ชุมชนที่ไม่เกี่ยวข้องอย่างเป็นทางการกับผู้พัฒนาหรือผู้ให้บริการเกม เครื่องหมายการค้าและทรัพย์สินของเกมเป็นของเจ้าของสิทธิ์ที่เกี่ยวข้อง

ข้อมูล Gameplay, Statistics, Tier, Matchup และ Recommendation อาจคลาดเคลื่อนหรือเปลี่ยนแปลงตาม Patch และแหล่งข้อมูล ควรใช้เป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำรับประกันผลการแข่งขัน

หน้าข้อมูลที่เกี่ยวข้องภายในเว็บไซต์:

- [Privacy Policy](https://rovlab.vercel.app/privacy)
- [Terms of Use](https://rovlab.vercel.app/terms)
- [Disclaimer](https://rovlab.vercel.app/disclaimer)
- [Data Sources](https://rovlab.vercel.app/data-sources)
- [Community Guidelines](https://rovlab.vercel.app/community-guidelines)

---

<p align="center">
  <strong>RoV LAB — Reliable Data. Explainable Analysis. Better Decisions.</strong>
</p>
