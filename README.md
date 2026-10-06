# RoV LAB — README Update

> ใช้เนื้อหานี้อัปเดต README หลักของ repository ให้ตรงกับสถานะจริงของโปรเจกต์

---

# RoV LAB

RoV LAB คือเว็บเครื่องมือสำหรับผู้เล่น RoV/Arena of Valor เน้นข้อมูลฮีโร่, matchup, counter, synergy, draft assistant, tier list, item build และ community features

## Current Status

> **Development / Release Hardening**

ระบบหลักส่วนใหญ่มี implementation แล้ว และโปรเจกต์กำลังเข้าสู่ช่วง:

- data completion
- security hardening
- asset verification
- QA / release preparation

ไม่ควรถือว่า project อยู่ในช่วง "เริ่มสร้าง feature หลัก" แล้ว

---

# Completed / Implemented

## Core

- Hero list
- Hero detail
- Hero abilities
- Ability effect tags
- Hero roles / lanes
- Hero counters
- Item data
- Item builds
- Arcana data

## Draft

- Draft Assistant
- Enemy hero selection
- Counter recommendations
- Synergy/recommendation logic
- Draft-related scoring/heuristics

## Matchup

- Matchup UI
- Two-way matchup handling
- Real matchup data support
- Fallback to available data
- Overall win rate is explicitly not treated as head-to-head data

เมื่อไม่มี matchup โดยตรง ระบบควรแสดงเฉพาะข้อมูลที่มีจริง เช่น overall win rate และ counter information

## Tier List

- Custom Tier List
- Hero placement
- Reordering
- Save
- Share Image

## Community

- Profiles
- Handles
- Comments
- Replies
- Mentions
- Reactions
- Follows
- Notifications
- Moderation/admin support

## UX

- Responsive mobile/desktop UI
- Unified Toast
- Loading states
- Empty states
- Error handling

---

# Data Status

Live database currently contains approximately:

| Dataset | Approx. records |
|---|---:|
| Heroes | 129 |
| Hero abilities | 606 |
| Items | 122 |
| Item builds | 107 |
| Item build items | 640 |
| Arcana | 30 |
| Banned words | 42 |
| Image URL backup | 871 |

> ตัวเลขอาจเปลี่ยนตาม migration/data update ล่าสุด

### Known Data Work

ยังต้องเพิ่ม/ตรวจสอบ coverage ของ:

- Matchups
- Synergies
- Counter relationships
- Draft recommendation quality
- Item build relationships

จำนวนข้อมูลใน DB ไม่ได้หมายความว่าทุก row ผ่านการตรวจสอบ gameplay quality แล้ว

---

# Current Priorities

## P0 — Security

- Auth verification
- Handle/username consistency
- RLS audit
- SECURITY DEFINER audit
- Admin RPC authorization
- Function search_path
- Supabase Auth password protection

## P1 — Gameplay Data

- Matchup coverage
- Synergy coverage
- Counter coverage
- Draft recommendation quality

## P1 — Asset Infrastructure

- Hero icons
- Ability icons
- Item icons
- Arcana icons
- External CDN cleanup
- Image migration verification

## P1 — QA

- Build
- TypeScript
- Browser verification
- Mobile
- Desktop
- Auth
- Matchup
- Draft
- Tier List
- Share Image
- Community

---

# Important Product Principles

## Data honesty

RoV LAB ต้องไม่สร้างความเข้าใจผิดจากข้อมูลที่ไม่มี

ถ้าไม่มีข้อมูล:

> ไม่ควร fabricate ตัวเลข

และไม่ควรนำ:

> overall win rate

ไปแสดงในฐานะ:

> head-to-head win rate

---

# Feature Scope

Feature ที่มี implementation แล้ว **ไม่ควรถูกสร้างใหม่เพียงเพื่อ refactor UI**

โดยเฉพาะ:

- Matchup
- Custom Tier List
- Share Image
- Draft Assistant
- Community
- Unified Toast

การแก้ควรเน้น:

- bug fix
- data quality
- security
- performance
- accessibility
- responsive behavior
- release hardening

---

# Claude Work Allocation

งานพัฒนาปัจจุบันแบ่งเป็น 4 tracks:

### Claude #1 — Gameplay Data

รับผิดชอบ:

- Matchups
- Synergies
- Counters
- Draft data
- Item build data

### Claude #2 — Auth + Security

รับผิดชอบ:

- Auth
- Handle
- Email verification
- RLS
- SECURITY DEFINER
- Admin RPC
- Supabase security

### Claude #3 — Assets

รับผิดชอบ:

- Image migration
- Storage
- External CDN cleanup
- Image verification
- Migration function cleanup

### Claude #4 — QA

รับผิดชอบ:

- Build
- TypeScript
- Browser QA
- Responsive
- Regression
- Release blockers

---

# Release Definition

RoV LAB จะถือว่าพร้อมสำหรับ production release เมื่อ:

- [ ] Auth/verification ถูกต้อง
- [ ] Security ไม่มี critical/high unintended finding
- [ ] Admin operations ถูกป้องกัน
- [ ] Image assets ผ่าน verification
- [ ] Matchup data มี coverage ที่ใช้งานได้
- [ ] Synergy data มี coverage ที่ใช้งานได้
- [ ] Draft Assistant ใช้ข้อมูลจริงเป็นหลัก
- [ ] Build ผ่าน
- [ ] TypeScript ผ่าน
- [ ] Mobile QA ผ่าน
- [ ] Desktop QA ผ่าน
- [ ] Critical routes ผ่าน
- [ ] Share Image ผ่าน
- [ ] Community flow ผ่าน
- [ ] ไม่มี critical console/network error

---

# Development Rule

ก่อนแก้ feature ที่มีอยู่แล้ว:

1. ตรวจ implementation ปัจจุบัน
2. ตรวจ database/schema
3. ตรวจ usage จาก frontend
4. หลีกเลี่ยง breaking change
5. ทำ migration แบบ reproducible
6. ทดสอบ build
7. สรุปสิ่งที่เปลี่ยนใน commit

**อย่าแก้เพื่อให้ test ผ่านด้วยการลด security หรือซ่อน error**

---

# Documentation Note

README นี้ควรอัปเดตเมื่อ:

- schema สำคัญเปลี่ยน
- feature ใหม่ merge
- data migration สำคัญเสร็จ
- release status เปลี่ยน
