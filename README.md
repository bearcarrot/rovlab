RoV LAB

RoV LAB คือเว็บเครื่องมือสำหรับผู้เล่น RoV / Arena of Valor ที่เน้นการวิเคราะห์เกมและช่วยตัดสินใจก่อนและระหว่าง Draft โดยใช้ข้อมูลจริงจากเกมและฐานข้อมูลของระบบ มากกว่าการเป็นเว็บแจก Build แบบทั่วไป

Status: Development / Release Hardening

🌐 Production: https://rovlab.vercel.app
📦 Repository: https://github.com/bearcarrot/rovlab

⸻

🎯 Product Direction

RoV LAB ถูกออกแบบมาเพื่อช่วยตอบคำถามสำคัญระหว่างการเล่น เช่น

* ฮีโร่ตัวนี้เหมาะกับตำแหน่ง/เลนไหน?
* ถ้าเจอศัตรูชุดนี้ ควรเลือกฮีโร่อะไร?
* ฮีโร่สองตัวนี้ Matchup กันอย่างไร?
* ทีมของเราขาดอะไร?
* Pick นี้เข้ากับทีมมากน้อยแค่ไหน?
* Draft ทั้งชุดควรวางแผนอย่างไร?
* Tier List ของเราควรจัดอย่างไร?
* ผู้เล่นคนอื่นจัด Draft หรือ Tier List ไว้อย่างไร?

หลักสำคัญของโปรเจกต์คือ

ใช้ข้อมูลที่ตรวจสอบได้ และไม่สร้างตัวเลข Gameplay ขึ้นมาเองเพื่อให้ระบบดูสมบูรณ์

⸻

⚔️ Core Features

🦸 Hero

ระบบข้อมูลฮีโร่ประกอบด้วย

* Hero List
* Hero Detail
* Hero abilities / Skills
* Skill effect tags
* Role
* Lane
* Hero statistics
* Win Rate
* Pick Rate
* Ban Rate
* Tier
* Counter
* Synergy
* Hero balance information

ข้อมูลฮีโร่ถูกนำไปใช้ร่วมกับ Tier List, Matchup, Counter Pick, Draft Assistant และ Coach AI

⸻

🏆 Tier List

หน้า Tier List มี 3 โหมดหลัก

Official Tier List

Tier ที่ระบบแสดงให้ผู้ใช้ทั่วไป

รองรับ:

* Rank
* Role
* Lane
* Tier
* Patch
* Hero statistics
* Admin-curated Tier List
* Fallback ไปใช้สถิติ Hero เมื่อไม่มี curated list

ฮีโร่ภายในแต่ละ Tier เรียงตามชื่อ ไม่ใช้ลำดับการแสดงผลเพื่อสื่อว่าใครแข็งแกร่งกว่าใคร

My Tier List

ผู้ใช้สามารถสร้าง Tier List ของตัวเอง

รองรับ:

* สร้าง Tier List
* เพิ่ม/ลบ Hero
* จัด Hero ลง Tier
* ย้าย Hero
* บันทึก
* แก้ไข
* แชร์
* โหลดกลับมาแก้ไข
* สร้าง Share Image

Community Tier List

แสดง Tier List ที่ผู้ใช้อื่นเผยแพร่

รองรับแนวคิด:

* Public Tier List
* ผู้สร้าง
* รายละเอียด
* ดูรายการ
* Load Preset
* โหลดเป็นสำเนาเพื่อไม่แก้ต้นฉบับ
* Community interaction

⸻

⚔️ Matchup

ระบบ Matchup ใช้ข้อมูลความสัมพันธ์ระหว่างฮีโร่สองตัว

รองรับ:

* Hero A vs Hero B
* Hero B vs Hero A
* Direct Matchup
* Counter data
* Overall Win Rate
* Lane information
* Coach AI context

Data Rule

หากมี Direct Matchup

แสดง Direct Matchup

หากไม่มี Direct Matchup

แสดงเฉพาะข้อมูลที่มีจริง เช่น Counter หรือ Overall Win Rate

Overall Win Rate ห้ามถูกนำเสนอว่าเป็น Head-to-Head Win Rate

ห้ามสร้าง Matchup statistics จากการเดา

⸻

🎯 Counter Pick

Counter Pick ใช้สำหรับค้นหาฮีโร่ที่เหมาะกับศัตรูที่กำหนด

ข้อมูลที่สามารถนำมาพิจารณาได้ เช่น

* Counter relationship
* Role
* Lane
* Tier
* Hero statistics
* Team composition

เป้าหมายคือให้ผู้ใช้สามารถหาตัวเลือกสำหรับ Draft ได้รวดเร็ว โดยไม่สร้างสถิติปลอมขึ้นมาเพื่อเพิ่มจำนวนผลลัพธ์

⸻

🧠 Draft Assistant

Draft Assistant เป็นหนึ่งในฟีเจอร์หลักของ RoV LAB

ระบบวิเคราะห์ Draft จาก

* Hero statistics
* Counter
* Synergy
* Role
* Lane
* Tier
* Skill / Ability
* Team composition
* Team gaps
* Enemy composition

ระบบสามารถแนะนำ Pick ตามสถานการณ์ เช่น

* First Pick
* Counter
* Composition
* Synergy
* เติมจุดที่ทีมขาด

พร้อมแสดงข้อมูลประกอบ Recommendation แทนการให้เพียงคะแนนโดยไม่มีเหตุผล

⸻

🎮 Draft Series

Draft Assistant รองรับการจำลอง Draft แบบ Series

รองรับ Format:

* Single Game
* Best of 3
* Best of 5
* Best of 7

ข้อมูลของแต่ละเกมสามารถเก็บ Pick / Ban แยกกันภายใน Series ได้

⸻

🌐 Global Ban Pick

Draft Series รองรับกฎ Global Ban Pick

แนวคิดคือ Hero ที่ทีมเคย Pick ในเกมก่อนหน้าของ Series จะถูกจำกัดไม่ให้ทีมเดิม Pick ซ้ำในเกมถัดไป

ระบบจะแยกข้อจำกัดของแต่ละทีมออกจากกัน

* Hero ที่ทีมเราเคย Pick → จำกัดสำหรับทีมเรา
* Hero ที่ทีมศัตรูเคย Pick → จำกัดสำหรับทีมศัตรู
* Ban ไม่ถือเป็น Pick สำหรับกฎนี้

ระบบ Recommendation และ Hero Pool จะคำนึงถึงข้อจำกัดดังกล่าวด้วย

⸻

💾 My Draft

ผู้ใช้สามารถบันทึก Draft ของตัวเอง

รองรับ:

* Save Draft
* Edit Draft
* Delete Draft
* Duplicate Draft
* Private / Public
* Draft description
* Draft Series
* Global Ban Pick
* Load Draft
* Load เป็นสำเนา

Draft ที่โหลดจาก Community จะไม่แก้ไขต้นฉบับโดยตรง

⸻

👥 Community Draft

Community Draft เป็นพื้นที่สำหรับแชร์ Draft ให้ผู้เล่นคนอื่นนำไปศึกษาและทดลองต่อ

รองรับ:

* Public Draft
* Search
* Sort
* Latest
* Popular
* Most liked
* Like
* Dislike
* View Draft
* Load Preset
* Author profile / handle
* Draft version
* Draft description

ระบบใช้ Snapshot สำหรับ Draft ที่เผยแพร่ เพื่อให้การแก้ไข Draft ของเจ้าของในภายหลังไม่ทำให้ข้อมูลที่ Community เคยเห็นเปลี่ยนโดยไม่ตั้งใจ

⸻

📊 Statistics

หน้า Stats ใช้ข้อมูลสถิติของฮีโร่ตาม Rank

รองรับ:

* Win Rate
* Pick Rate
* Ban Rate
* Role filter
* Lane filter
* Rank filter
* Patch information

ปัจจุบันมี Rank bucket สำหรับ

* All
* High

ข้อมูลสถิติจะแสดงเฉพาะ Hero ที่มีข้อมูลจริงในช่วง Rank ที่เลือก

⸻

🤖 Coach AI

RoV LAB มีระบบ Coach AI สำหรับช่วยวิเคราะห์สถานการณ์ Draft

AI สามารถได้รับ context เช่น

* Hero ในทีมเรา
* Hero ฝั่งศัตรู
* Hero abilities
* Skill information
* Counter / Matchup
* Team composition
* Team gaps

หลักการสำคัญของ Prompt:

AI ต้องใช้เฉพาะข้อมูลที่ระบบส่งให้ และไม่ควรแต่งชื่อสกิล ตัวเลข หรือ Gameplay statistics ที่ไม่มีอยู่ในข้อมูล

หากข้อมูลไม่เพียงพอ ควรระบุว่าไม่มีข้อมูลเพียงพอแทนการเดา

⸻

🖼️ Share Image

RoV LAB รองรับการสร้างภาพสำหรับแชร์ข้อมูล

ปัจจุบันมีการใช้งานกับ เช่น

* Tier List
* Custom Tier List
* Draft

ระบบต้องรองรับ:

* Hero icons
* ภาษาไทย
* ชื่อยาว
* Image loading fallback
* Mobile
* Desktop
* การโหลดรูปก่อนสร้างภาพ
* Download
* Share

⸻

👤 User & Community

ระบบบัญชีผู้ใช้รองรับฟีเจอร์ Community เช่น

* Register
* Login
* Email verification
* Profile
* Handle
* Public profile
* Follow
* Feed
* Notifications
* Comments
* Replies
* Mentions
* Reactions
* Community content

Community features ต้องทำงานร่วมกับระบบ authorization และ RLS ของ Supabase

⸻

🛡️ Security

โปรเจกต์มีการทำ Security Hardening แล้วหลายส่วน

ครอบคลุมแนวทาง เช่น

* Supabase Auth
* Email verification
* Row Level Security (RLS)
* Admin authorization
* SECURITY DEFINER functions
* Function search_path
* Security headers
* Content Security Policy
* AI Coach quota
* Database policy optimization
* Public / private data separation

หลักการคือ

ไม่ปิด Security เพื่อให้ Feature ทำงานได้ง่ายขึ้น

และต้องระวังไม่ให้การเพิ่ม RLS ทำให้ Public Gameplay Data ที่ตั้งใจให้ผู้ใช้ทั่วไปอ่านได้ถูกบล็อกโดยไม่จำเป็น

⸻

⚡ Performance

RoV LAB มีการปรับ Performance สำหรับ Production แล้วหลายส่วน

Route-level Code Splitting

หน้า Home ถูกโหลดแบบ eager เพื่อรักษา First Contentful Paint ส่วนหน้าอื่นใช้ route-level lazy loading

ตัวอย่างหน้าที่แยกโหลด:

* Heroes
* Hero Detail
* Tier List
* Counter Pick
* Matchup
* Draft
* Stats
* Learn
* Profile
* Admin
* Community
* Legal pages

Database / Request Optimization

มีการปรับปรุง เช่น

* Database indexes
* RLS initplan optimization
* Parallel hero queries
* In-memory TTL cache
* Cache เฉพาะข้อมูลที่อ่านสำเร็จ
* ลด duplicate requests

Initial Paint

มีการปรับปรุงเพิ่มเติมสำหรับ PageSpeed / Lighthouse เช่น

* Supabase preconnect
* Non-blocking Google Fonts
* Inline entry CSS
* Static boot shell
* Route code splitting

Performance ยังถือเป็นงานที่ต้องติดตามต่อเนื่อง ไม่ถือว่าคะแนน Lighthouse เป็นสิ่งที่รับประกันตายตัว

⸻

🗃️ Data Philosophy

RoV LAB ให้ความสำคัญกับ Data Honesty

ห้าม

* Fabricate Win Rate
* Fabricate Pick Rate
* Fabricate Ban Rate
* Fabricate Matchup statistics
* Fabricate Counter statistics
* Fabricate Synergy score
* ใช้ Overall Win Rate เป็น Head-to-Head
* สร้างข้อมูลจากการเดาแล้วนำเสนอเหมือนเป็น Official Data

ควร

* ระบุแหล่งข้อมูล
* แยกข้อมูลจริงออกจาก heuristic
* แสดงเฉพาะข้อมูลที่มี
* ไม่แสดง placeholder ที่ทำให้เข้าใจว่ามีข้อมูล
* ตรวจสอบความสัมพันธ์ของข้อมูล
* ตรวจสอบ duplicate / reverse relationship
* ทำให้ source และ data pipeline ตรวจสอบย้อนหลังได้

ข้อมูลน้อยแต่ถูกต้อง ดีกว่าข้อมูลเยอะแต่แต่งขึ้นมา

⸻

🧱 Item / Rune / Arcana Strategy

RoV LAB ไม่ได้ตั้งใจแข่งขันกับระบบ Preset ภายในเกม

เกมมีข้อมูล Top Server Preset สำหรับ:

* Item
* Rune / Arcana
* Enchantment / พลังแฝง

ข้อมูลเหล่านี้มีโอกาสอัปเดตกว่า และตรงกับ Meta ปัจจุบันมากกว่าการที่ RoV LAB จะต้องดูแล Preset เอง

ดังนั้น RoV LAB จึงไม่ควร hard-code Build/Rune/Enchantment recommendation โดยไม่มี source ที่น่าเชื่อถือ

หากอนาคตมี API หรือ Source ที่สามารถดึง Top Server Preset ได้:

RoV Game / Reliable Source
          ↓
     Dynamic Data
          ↓
       RoV LAB

จะเหมาะสมกว่าการสร้าง Preset ขึ้นมาเอง

ข้อมูล Item / Arcana ที่มีอยู่ใน Database สามารถใช้เป็น เกมเพลย์ reference / supporting data สำหรับระบบอื่นได้ แต่ไม่ควรนำไปสร้างระบบ Build ที่ต้องแข่งขันกับ Preset ในเกมโดยไม่มีข้อมูลที่เชื่อถือได้

⸻

🗂️ Current Routes

Route หลักที่มีอยู่ในระบบ เช่น

/
├── /heroes
├── /heroes/:slug
├── /tier-list
├── /counter-pick
├── /matchup
├── /draft
├── /stats
├── /learn
├── /learn/:slug
├── /favorites
├── /feed
├── /notifications
├── /profile
├── /players/:id
├── /u/:handle
├── /admin
├── /login
├── /register
├── /forgot-password
├── /reset-password
├── /privacy
├── /terms
├── /disclaimer
├── /data-sources
└── /community-guidelines

Legacy /build ถูก redirect กลับหน้าแรก เนื่องจากไม่ได้เป็น Product Priority ในปัจจุบัน

⸻

🏗️ Tech Stack

Frontend

* React 18
* TypeScript
* Vite
* React Router
* Tailwind CSS
* shadcn/ui style components
* Radix UI
* Lucide React

Backend / Data

* Supabase
* PostgreSQL
* Supabase Auth
* Row Level Security
* RPC / Database Functions
* Supabase Storage

Deployment

* GitHub
* Vercel

Repository

bearcarrot/rovlab

Production

https://rovlab.vercel.app

⸻

📦 Development

Requirements

* Node.js
* npm
* Supabase project
* Environment variables สำหรับ Supabase

ติดตั้ง dependencies:

npm install

รัน Development:

npm run dev

Build:

npm run build

TypeScript check:

npm run typecheck

Lint:

npm run lint

Preview Production Build:

npm run preview

⸻

🔄 Development Workflow

การพัฒนา RoV LAB ควรแบ่ง Scope ให้ชัดเจนเมื่อทำงานหลาย Agent / Claude พร้อมกัน

Gameplay / Data

รับผิดชอบ:

* Hero data
* Matchup
* Counter
* Synergy
* Draft recommendation
* Statistics
* Data quality

Auth / Security

รับผิดชอบ:

* Auth
* Email verification
* Handle
* RLS
* RPC
* SECURITY DEFINER
* Admin permissions
* Security headers
* AI quota

Community

รับผิดชอบ:

* My Draft
* Community Draft
* My Tier List
* Community Tier List
* Reactions
* Follow
* Feed
* Notifications
* Moderation

Assets

รับผิดชอบ:

* Hero images
* Skill images
* Item images
* Arcana images
* Supabase Storage
* External CDN
* Image fallback
* Asset migration

Performance / QA

รับผิดชอบ:

* Lighthouse
* FCP
* LCP
* Bundle size
* Route splitting
* Request count
* Build
* TypeScript
* Browser QA
* Mobile QA
* Desktop QA
* Regression

⸻

🚫 Development Guardrails

ก่อนแก้ Feature ที่มีอยู่แล้ว:

1. อ่าน implementation ปัจจุบันก่อน
2. ตรวจ database/schema ที่เกี่ยวข้อง
3. ตรวจว่า feature ถูกใช้งานที่ไหนบ้าง
4. ตรวจ PR / migration ที่เกี่ยวข้อง
5. หลีกเลี่ยง breaking changes
6. อย่าแก้ไฟล์นอก scope โดยไม่จำเป็น
7. อย่าลบข้อมูลโดยไม่มี backup
8. อย่าปิด security เพื่อให้ test ผ่าน
9. อย่าสร้าง Gameplay Data ที่ไม่มี source
10. อย่าเปลี่ยน UI ที่ทำเสร็จแล้วโดยไม่มี requirement
11. ถ้า Feature มีอยู่แล้ว ให้แก้ต่อจาก implementation เดิมแทนการสร้างระบบใหม่
12. ทุก Recommendation ที่มีตัวเลขต้องสามารถอธิบาย source ได้

⸻

🧪 QA / Release

ก่อน Release ควรตรวจอย่างน้อย:

Authentication

* [ ]	Register
* [ ]	Login
* [ ]	Email verification
* [ ]	Password reset
* [ ]	Google OAuth
* [ ]	Protected routes
* [ ]	Handle

Gameplay

* [ ]	Heroes
* [ ]	Hero Detail
* [ ]	Tier List
* [ ]	Counter Pick
* [ ]	Matchup
* [ ]	Stats
* [ ]	Draft Assistant
* [ ]	Draft Series
* [ ]	Global Ban Pick
* [ ]	Coach AI

User Content

* [ ]	My Tier List
* [ ]	Community Tier List
* [ ]	My Draft
* [ ]	Community Draft
* [ ]	Save / Edit / Delete
* [ ]	Public / Private
* [ ]	Load Preset
* [ ]	Like / Dislike
* [ ]	Share Image

Community

* [ ]	Profile
* [ ]	Handle
* [ ]	Follow
* [ ]	Feed
* [ ]	Notifications
* [ ]	Comments
* [ ]	Replies
* [ ]	Mentions
* [ ]	Moderation

Security

* [ ]	RLS
* [ ]	Admin authorization
* [ ]	RPC permissions
* [ ]	SECURITY DEFINER audit
* [ ]	Function search_path
* [ ]	Security headers
* [ ]	AI quota

Performance

* [ ]	Build passes
* [ ]	TypeScript passes
* [ ]	No critical console errors
* [ ]	No obvious broken images
* [ ]	No infinite requests
* [ ]	Mobile QA
* [ ]	Desktop QA
* [ ]	Lighthouse regression check

⸻

📌 Current Product Priorities

ลำดับความสำคัญของ RoV LAB ปัจจุบันคือ

1. Data Quality
2. Draft / Matchup / Counter / Synergy
3. Community Tier List / Draft
4. Auth + Security
5. Performance
6. QA / Release

ไม่ใช่การเพิ่ม Feature จำนวนมากอย่างต่อเนื่อง

เป้าหมายคือ

ทำให้ Feature ที่มีอยู่ใช้งานจริง ข้อมูลถูกต้อง ระบบปลอดภัย และประสบการณ์ใช้งานดี

⸻

📝 Important Scope Decisions

Build Page

Standalone /build ไม่ใช่ Product Priority ในปัจจุบัน

ข้อมูล Build ที่มีอยู่สามารถนำไปใช้กับระบบอื่นได้ แต่ไม่จำเป็นต้องสร้างเว็บ Build แยกอีกระบบหนึ่ง

⸻

Top Server Preset

ไม่ควร maintain Item / Rune / Enchantment Preset เอง หากเกมมีข้อมูล Top Server ที่ใหม่กว่า

⸻

Matchup

หากไม่มี Direct Matchup:

อย่าแสดง Overall Win Rate เหมือนเป็น Head-to-Head

⸻

Community Content

Community Draft / Tier List ที่โหลดมา ต้องทำงานแบบ Copy / Preset

ไม่ควรแก้ต้นฉบับของผู้สร้างโดยตรง

⸻

Gameplay Data

หากไม่มีข้อมูลที่น่าเชื่อถือ:

ไม่มีข้อมูล ดีกว่าสร้างตัวเลขขึ้นมาเอง

⸻

📜 Legal / Disclaimer

RoV LAB เป็นโปรเจกต์ชุมชนที่สร้างขึ้นเพื่อช่วยผู้เล่นวิเคราะห์เกมและจัดการ Draft

RoV LAB ไม่ใช่เว็บไซต์หรือบริการอย่างเป็นทางการของผู้พัฒนา/ผู้ให้บริการเกม

ข้อมูล Gameplay, Statistics, Tier, Matchup และ Recommendation อาจมีความคลาดเคลื่อนหรือเปลี่ยนแปลงตาม Patch และแหล่งข้อมูล

ผู้ใช้ควรใช้ข้อมูลจาก RoV LAB เป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำรับประกันผลการแข่งขัน

รายละเอียดเพิ่มเติม:

* Privacy Policy
* Terms of Use
* Disclaimer
* Data Sources
* Community Guidelines

สามารถเข้าถึงได้จากหน้า Legal ภายในเว็บไซต์

⸻

📅 Project Status

Last verified: 2026-10-08

สถานะปัจจุบัน:

Core Product Implemented → Feature Expansion → Security / Performance Hardening → QA → Release

Recent development milestones include:

* Draft Series Engine
* Global Ban Pick
* My Draft
* Community Draft
* Community reactions
* Community Tier List
* Custom Tier List Share Image
* Real Matchup Data
* Supabase Auth / Security Hardening
* Database / RLS Performance Optimization
* AI Coach quota / security hardening
* Route-level Code Splitting
* Initial paint / font / Supabase connection optimization
* Admin Statistics improvements

ล่าสุดยังมีงาน Release Hardening / QA ที่ดำเนินต่อเนื่อง

⸻

🚀 Vision

RoV LAB ไม่ได้ตั้งเป้าเป็นเพียงเว็บไซต์ที่รวมข้อมูลฮีโร่

เป้าหมายคือการเป็น เครื่องมือวิเคราะห์ RoV สำหรับผู้เล่นจริง

ตั้งแต่

Hero Data
    ↓
Statistics
    ↓
Matchup / Counter / Synergy
    ↓
Draft Analysis
    ↓
Draft Series
    ↓
Coach AI
    ↓
Community Knowledge

โดยมีหลักการเดียวกันตลอดทั้งระบบ:

Reliable Data → Explainable Analysis → Better Decisions
