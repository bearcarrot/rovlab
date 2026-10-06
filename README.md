# RoV LAB

RoV LAB คือเว็บเครื่องมือสำหรับผู้เล่น RoV / Arena of Valor ที่เน้น **การวิเคราะห์เกม การเลือกฮีโร่ Matchup, Counter, Draft และข้อมูลจากชุมชน** มากกว่าการทำระบบ Build/Rune แข่งกับข้อมูลภายในเกม

> **Current Status:** Development / Release Hardening

---

## 🎯 Product Direction

RoV LAB ตั้งใจเป็นเครื่องมือช่วยตัดสินใจก่อนและระหว่าง Draft โดยเน้นข้อมูลที่ช่วยตอบคำถาม เช่น

- ฮีโร่ตัวนี้แพ้/ชนะทางใคร?
- ถ้าเจอศัตรูชุดนี้ ควรเลือกฮีโร่อะไร?
- ฮีโร่สองตัวนี้ Matchup กันอย่างไร?
- ตัวไหนเหมาะกับทีมของเรา?
- Tier List ของเราควรจัดอย่างไร?
- ข้อมูลจาก Community และผู้เล่นคนอื่นมีความคิดเห็นอย่างไร?

### สิ่งที่ RoV LAB ไม่จำเป็นต้องทำซ้ำ

ในเกมมีระบบ **Preset ของ Top Server** สำหรับ:

- Item
- Rune / Arcana
- พลังแฝง

ข้อมูลเหล่านี้มีโอกาสอัปเดตกว่าและตรงกับ Meta ปัจจุบันมากกว่าการที่ RoV LAB จะต้องสร้างและดูแลฐานข้อมูลเอง

ดังนั้น:

> **RoV LAB ไม่ได้มีเป้าหมายเป็นเว็บแจก Build / Rune / พลังแฝง**

หากในอนาคตมี source หรือ API ที่สามารถดึง Preset Top Server ได้อย่างน่าเชื่อถือ อาจนำมาแสดงแบบ dynamic ได้ แต่ไม่ควรสร้างข้อมูล preset เองโดยไม่มีแหล่งข้อมูลที่เชื่อถือได้

---

# 🚀 Core Features

## Hero

- Hero List
- Hero Detail
- Hero abilities
- Ability effect tags
- Role / Lane
- Hero statistics
- Counter information
- Synergy information

## Draft Assistant

ช่วยวิเคราะห์ Draft จากฮีโร่ที่เลือก/ศัตรูที่พบ

รองรับแนวคิด:

- Counter
- Synergy
- Role
- Lane
- Tier
- Risk
- Recommendation
- Team composition

เป้าหมายคือให้ recommendation ใช้ **ข้อมูลจริง** เป็นหลัก ไม่ใช่สร้างคำแนะนำจากข้อมูลสมมติ

---

# ⚔️ Matchup

ระบบ Matchup ใช้สำหรับดูความสัมพันธ์ระหว่างฮีโร่สองตัว

รองรับ:

- Hero A vs Hero B
- Hero B vs Hero A
- Matchup data โดยตรง
- Counter data
- Overall Win Rate

### Data Rule

หากมีข้อมูล Matchup โดยตรง:

> แสดง Matchup โดยตรง

หากไม่มี Matchup โดยตรง:

> แสดงเฉพาะข้อมูลที่มีจริง เช่น Overall Win Rate และ Counter

**Overall Win Rate ห้ามถูกนำเสนอว่าเป็น Head-to-Head Win Rate**

หากข้อมูลบางส่วนไม่มี:

> ไม่จำเป็นต้องแสดงหัวข้อ placeholder ว่า “ยังไม่มีข้อมูล”

---

# 🏆 Custom Tier List

มีระบบสร้าง Tier List ของตัวเอง

รองรับ:

- สร้าง Tier List
- เพิ่ม Hero
- จัดลำดับ
- ย้าย Hero
- แก้ไข
- บันทึก
- แชร์
- สร้าง Share Image

Feature นี้มี implementation แล้ว ไม่ควรถูกรื้อหรือสร้างใหม่โดยไม่มีเหตุผล

---

# 🖼️ Share Image

สามารถสร้างภาพสำหรับแชร์ข้อมูล เช่น:

- Custom Tier List
- Draft
- ข้อมูลที่เหมาะสมสำหรับการแชร์

ต้องรองรับ:

- Hero icon
- ภาษาไทย
- ชื่อยาว
- Mobile
- Desktop
- Image loading fallback

---

# 👥 Community

ระบบ Community มีแนวทางรองรับ:

- Profile
- Handle
- Comments
- Replies
- Mentions
- Reactions
- Follow
- Notifications
- Moderation

Community data ต้องคำนึงถึง:

- Spam
- Abuse
- Rate limit
- Banned words
- RLS
- Admin permissions

---

# 📊 Current Database

ข้อมูลที่ตรวจพบจาก Supabase live database โดยประมาณ:

| Dataset | Records |
|---|---:|
| Heroes | 129 |
| Hero abilities | 606 |
| Items | 122 |
| Item builds | 107 |
| Item build items | 640 |
| Arcana | 30 |
| Banned words | 42 |
| Image URL backup | 871 |

> จำนวน records สามารถเปลี่ยนแปลงได้ตาม migration/data update ล่าสุด

### สำคัญ

การมีข้อมูลอยู่ใน Database ไม่ได้หมายความว่าข้อมูลทุก row ผ่านการตรวจสอบ gameplay quality แล้ว

โดยเฉพาะข้อมูลที่สำคัญต่อ recommendation:

- Matchup
- Counter
- Synergy

ต้องเน้น **คุณภาพและความถูกต้องของข้อมูล** มากกว่าการเพิ่มจำนวน rows อย่างเดียว

---

# 📌 Current Data Priorities

## P0 — Matchup / Counter / Synergy

เพิ่มและตรวจสอบ:

- Matchup coverage
- Counter coverage
- Synergy coverage
- Duplicate relationships
- Reverse relationships
- Invalid/self relationships
- Data consistency

ห้าม fabricate gameplay statistics

หากไม่มีข้อมูลที่น่าเชื่อถือ:

> ให้ไม่มีข้อมูล ดีกว่าสร้างตัวเลขขึ้นมาเอง

---

## P1 — Draft Quality

ปรับ Draft Assistant ให้ใช้ข้อมูลจริงมากขึ้น:

- Counter
- Synergy
- Role
- Lane
- Tier
- Risk
- Team composition

ไม่ควรเพิ่ม heuristic ที่ไม่มีเหตุผลเพียงเพื่อให้ผลลัพธ์ดูเยอะขึ้น

---

## P1 — Security

ตรวจ:

- Authentication
- Email verification
- Handle
- RLS
- SECURITY DEFINER
- Admin RPC
- Function search_path
- Supabase Auth security settings

ต้องไม่ทำให้ public gameplay data ที่ตั้งใจเปิดใช้งานกลายเป็น inaccessible โดยไม่จำเป็น

---

## P1 — Asset Infrastructure

ตรวจ:

- Hero images
- Ability images
- Item images
- Arcana images
- External CDN
- Supabase Storage
- Image backup
- Migration functions

เป้าหมายคือให้ image assets เสถียรและลด dependency ที่ไม่จำเป็นจาก external CDN

---

## P1 — QA / Release

ตรวจ:

- Build
- TypeScript
- Browser
- Mobile
- Desktop
- Auth
- Matchup
- Draft
- Tier List
- Share Image
- Community
- Notifications

---

# 🧩 Data Philosophy

RoV LAB ให้ความสำคัญกับ **Data Honesty**

### ห้าม

- Fabricate win rate
- Fabricate matchup statistics
- Fabricate synergy score
- ใช้ overall win rate เป็น head-to-head
- สร้างข้อมูลจากการเดาแล้วนำเสนอเหมือนเป็น official data

### ควร

- ระบุแหล่งข้อมูล
- แยกข้อมูลจริงกับ heuristic
- ซ่อนส่วนที่ไม่มีข้อมูล
- แสดง confidence เมื่อเหมาะสม
- เก็บข้อมูลให้อัปเดตได้ง่าย

---

# 🔄 Item / Rune / Arcana / Enchantment Strategy

RoV LAB มีข้อมูล Item และ Arcana ในฐานข้อมูลเพื่อรองรับข้อมูลเกม/ระบบที่จำเป็น แต่ **ไม่ควรสร้างระบบแข่งขันกับ Preset Top Server ของเกม**

สำหรับ:

- Item Preset
- Rune / Arcana Preset
- พลังแฝง Preset

ให้ถือว่า **ข้อมูลจากเกมเป็นแหล่งข้อมูลหลัก**

หากอนาคตสามารถดึง Preset Top Server ได้:

```text
RoV Game / Official Source
        ↓
   Dynamic Data
        ↓
      RoV LAB
```

ดีกว่าการ hard-code preset แล้วต้องคอยแก้เองทุกครั้งที่ Meta เปลี่ยน

---

# 🏗️ Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide
- Supabase
- Vercel
- GitHub

Repository:

`bearcarrot/rovlab`

Production:

`rovlab.vercel.app`

---

# 👨‍💻 Development Workflow

โปรเจกต์สามารถแบ่งงานให้ Claude หลายตัวทำพร้อมกันได้ แต่แต่ละ agent ต้องมี scope ชัดเจน

## Claude #1 — Gameplay Data

รับผิดชอบ:

- Matchup
- Counter
- Synergy
- Draft data quality

ไม่รับผิดชอบ:

- Item Build
- Rune
- พลังแฝง
- UI redesign

---

## Claude #2 — Auth + Security

รับผิดชอบ:

- Auth
- Email verification
- Handle
- RLS
- SECURITY DEFINER
- Admin authorization
- Supabase security

---

## Claude #3 — Assets

รับผิดชอบ:

- Image migration
- Image verification
- Storage
- External CDN cleanup
- Migration function cleanup

---

## Claude #4 — QA

รับผิดชอบ:

- Build
- TypeScript
- Browser QA
- Responsive QA
- Regression
- Release blockers

---

# 🚫 Development Guardrails

ก่อนแก้ feature ที่มีอยู่แล้ว:

1. อ่าน implementation ปัจจุบันก่อน
2. ตรวจ database/schema ที่เกี่ยวข้อง
3. ตรวจว่า feature ถูกใช้งานที่ไหนบ้าง
4. หลีกเลี่ยง breaking changes
5. อย่าแก้ไฟล์นอก scope โดยไม่จำเป็น
6. อย่าลบข้อมูลโดยไม่มี backup
7. อย่าปิด security เพื่อให้ test ผ่าน
8. อย่าสร้างข้อมูล gameplay ที่ไม่มี source
9. อย่ารื้อ UI ที่ทำเสร็จแล้วเพื่อเปลี่ยน design โดยไม่มี requirement

---

# ✅ Release Definition

RoV LAB พร้อม Release เมื่อ:

- [ ] Auth ทำงานถูกต้อง
- [ ] Email verification ถูกต้อง
- [ ] Handle ทำงานถูกต้อง
- [ ] RLS ผ่านการ audit
- [ ] Admin functions ปลอดภัย
- [ ] ไม่มี critical security issue
- [ ] Matchup data มี coverage ที่ใช้งานได้
- [ ] Counter data มีคุณภาพ
- [ ] Synergy data มี coverage ที่ใช้งานได้
- [ ] Draft Assistant ใช้ข้อมูลจริงเป็นหลัก
- [ ] Image assets ผ่าน verification
- [ ] Build ผ่าน
- [ ] TypeScript ผ่าน
- [ ] Mobile QA ผ่าน
- [ ] Desktop QA ผ่าน
- [ ] Matchup ผ่าน
- [ ] Draft ผ่าน
- [ ] Tier List ผ่าน
- [ ] Share Image ผ่าน
- [ ] Community ผ่าน
- [ ] ไม่มี critical console error
- [ ] ไม่มี obvious broken image
- [ ] ไม่มี infinite request

---

# 📝 Known Scope Decisions

### Build Page

ข้อมูล Build ที่มีอยู่สามารถนำไปใช้กับ feature อื่นได้ แต่ **ไม่จำเป็นต้องรีบสร้าง standalone `/build` page**

ลำดับความสำคัญของ RoV LAB อยู่ที่:

> Matchup → Counter → Synergy → Draft → Tier → Community

มากกว่าการทำเว็บ Build อีกเว็บหนึ่ง

### Top Server Preset

ไม่ต้อง maintain Item/Rune/พลังแฝง preset เอง หากเกมมีข้อมูล Top Server ที่อัปเดตกว่า

### Community Tier List

ไม่จำเป็นต้องสร้างระบบ Community Tier Ranking ที่ซับซ้อนก่อน

ลำดับปัจจุบันเน้น:

- สร้าง Tier List ของตัวเอง
- บันทึก
- แชร์เป็นภาพ

ก่อน

---

# 📅 Project Status

**Last verified:** 2026-10-06

สถานะโดยรวม:

> Core product implemented → Data / Security / Assets → QA → Release

เป้าหมายถัดไปไม่ใช่การเพิ่ม feature จำนวนมาก แต่คือ:

> **ทำให้ข้อมูลถูกต้อง ระบบปลอดภัย และ feature ที่มีอยู่พร้อมใช้งานจริง**
