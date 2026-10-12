# วิเคราะห์เกมจากสกรีนชอต (Scoreboard OCR)

หน้า `/matches` ให้ผู้ใช้ที่ล็อกอินอัปโหลดสกรีนชอตหน้า "ประวัติการเล่น" หลังจบแมตช์ (ครั้งละ 1–3 รูป) ระบบอ่านตัวเลขด้วย Gemini ให้ผู้ใช้ตรวจ/แก้ แล้วบันทึกเป็นแมตช์ส่วนตัว จากนั้นคำนวณสถิติและข้อสังเกตจากแมตช์ที่สะสม สรุปย่อแสดงที่ล่างสุดของหน้า Home เฉพาะผู้ที่ล็อกอิน (`features/matches/MyMatchesCard.tsx`)

> สถานะ: เขียนและตรวจด้วยการอ่านโค้ดเท่านั้น ยังไม่ได้รัน build/typecheck/lint และยังไม่ได้วัดความแม่นของ OCR กับรูปจริง (ข้าม "Phase 0") — ดู Known limitations

## Flow

1. Client (`src/lib/image.ts → fileToScoreboardBase64`) เตรียมทีละไฟล์: ตรวจว่าเป็นรูปแนวนอน, ตัด 4% ล่าง (แถบ UID), ย่อด้านยาวไม่เกิน 1600 px, เข้ารหัส JPEG (ลบ EXIF) ไฟล์ที่ไม่ผ่านขั้นนี้ไม่ถูกส่งและไม่เสียโควต้า
2. Client (`services/matches.ts → scanScoreboards`) ส่ง **ทุกรูปใน request เดียว** ไปที่ Edge Function `scoreboard-ocr`: ตรวจล็อกอิน → หักโควต้า (atomic) → เรียก Gemini 1 ครั้งด้วย `responseSchema` → normalise → หาแถวของผู้ใช้ → ส่งผลกลับ **ไม่เก็บรูป ไม่เขียนตาราง**
3. Client (`Matches.tsx` + `ScanReview`): ตรวจ/แก้ทีละแมตช์ (หัวการ์ดแสดง n/N, ปุ่ม "ยกเลิก" = ข้ามแมตช์นั้น) ระบบเตือนเมื่อผลรวม Kill ไม่ตรงสกอร์ ฯลฯ ช่องฮีโร่ใช้ `HeroCombobox` (ค้นหา, ไอคอน, ตำแหน่งจาก `heroRoles()`)
4. Client `saveMatch`: insert เข้า `match_results` (RLS เจ้าของเท่านั้น) — **ไม่เก็บชื่อผู้เล่นคนอื่น**
5. `features/matches/stats.ts`: สรุปสถิติและข้อสังเกต **คำนวณด้วยโค้ดจากตัวเลขจริง** (ไม่ใช้ AI สร้างข้อความ)

รูปตัวอย่างข้างปุ่มอัปโหลดอยู่ที่ `public/example/scoreboard-example.webp` (ถ้าไม่มีไฟล์ กล่องรูปจะซ่อนเอง)

### การหาแถวของผู้ใช้ (ลำดับความน่าเชื่อถือ)

1. ชื่อในเกม (`profiles.game_name`) ตรงกับชื่อในรูป (ทีมฟ้าเท่านั้น, เทียบแบบหลวม เช่น `Ø` = `o`)
2. แถบที่สว่างกว่าที่โมเดลมองเห็น
3. ผู้ใช้เลือกเองในหน้าตรวจสอบ

### ฮีโร่ชื่อซ้ำ

หน้าจอเกมพิมพ์เฉพาะชื่อฐาน เช่น `Flowborn` แต่ในฐานข้อมูลมี `Flowborn (Carry)` และ `Flowborn (Mage)` `matchHero()` จึงเทียบชื่อเต็มก่อน แล้วเทียบชื่อที่ตัดวงเล็บ ถ้าได้หลายตัวถือว่ากำกวม ผู้ใช้ต้องเลือกจากรายการ (บังคับเฉพาะแถวของตัวเอง เพราะใช้คำนวณสถิติรายฮีโร่)

## หลายรูปต่อ request

- ส่งได้สูงสุด `MAX_IMAGES = 3` รูป (ฝั่ง client: `MAX_SCAN_IMAGES`) รูปละไม่เกิน 1.5 MB รวมไม่เกิน 4 MB
- Request: `{ images: string[] }` (base64 JPEG) · Response: `{ results: [{ index, ok: true, scan, meSource } | { index, ok: false, code, error }], remaining, resetsAt }` โดย `index` เริ่มที่ 1 ตรงกับลำดับที่ส่ง รูปที่ไม่ใช่หน้าสรุปผลได้ `code: "not_scoreboard"` ส่วนรูปที่โมเดลข้ามไปได้ `code: "missing"`
- ยังรับรูปแบบเดิม `{ image: string }` และตอบรูปแบบเดิม เพื่อไม่ให้หน้าเว็บเวอร์ชันเก่าพัง
- โมเดลได้รับป้าย "Image k" ก่อนแต่ละรูป และต้องตอบ `image_index` ของทุกรายการ ถ้าไม่ครบ ฟังก์ชันจะจับคู่ตามลำดับเฉพาะเมื่อจำนวนรายการเท่ากับจำนวนรูป
- `maxOutputTokens` = `3072 × จำนวนรูป + 1024` (ไม่เกิน 12,288)
- **โควต้า**: ต่อผู้ใช้นับเป็น **รูป** ทั้งระบบนับเป็น **request** (RPD ของ Gemini นับ request) `consume_ocr_quota(..., p_images)` ตรวจ cooldown + ขีดจำกัดต่อผู้ใช้ + ขีดจำกัดทั้งระบบใน transaction เดียว
- **คืนโควต้า**: ถ้า Gemini ล้มเหลวทั้งหมด คืนทั้งรูปและ request ถ้าโมเดลข้ามบางรูป (`missing`) คืนเฉพาะรูปนั้น (request ถือว่าใช้ไปแล้ว) รูปที่ไม่ใช่หน้าสรุปผลไม่คืน (กันการยิงรูปขยะ)
- ความเสี่ยง: ถ้า JSON เสียหรือถูกบล็อก ผู้ใช้เสียทั้งชุด และความแม่นเมื่อรวมหลายรูปยังไม่ได้วัด

## Deploy

ทำแล้วกับโปรเจกต์ `mttcdaiwuasnkqlxbeqs` (ตรวจซ้ำทุกครั้งที่ย้ายโปรเจกต์):

1. Migrations (เรียงตามชื่อไฟล์)
   - `20261010_match_results.sql` — ตาราง `match_results`, โควต้า OCR (applied 2026-10-10)
   - `20261011_match_analysis_activity_events.sql` — event ใหม่ใน `user_activity_events` (applied 2026-10-10)
   - `20261012_ocr_multi_image_quota.sql` — `p_images` / `refund_ocr_quota(p_user, p_images, p_request)` (applied 2026-10-12)
2. `supabase functions deploy scoreboard-ocr`
3. ตั้ง secrets (ใช้ `GEMINI_API_KEY` ที่มีอยู่แล้วร่วมกับ ai-coach/avatar)

| Secret | ค่าเริ่มต้น | หมายเหตุ |
| --- | --- | --- |
| `GEMINI_OCR_MODEL` | `gemini-3.1-flash-lite` | ใส่ model ID ให้ตรงกับที่ AI Studio แสดง |
| `GEMINI_OCR_FALLBACK_MODEL` | (ไม่ตั้ง) | ถ้าตั้ง รุ่นนี้จะใช้โควต้าของรุ่นนั้นแยกจาก OCR หลัก |
| `OCR_USER_DAILY_LIMIT` | `5` | **รูป** ต่อผู้ใช้ต่อวัน |
| `OCR_GLOBAL_DAILY_LIMIT` | `400` | **request** ทั้งระบบต่อวัน (เผื่อไว้จากโควต้า 500 RPD) |
| `OCR_COOLDOWN_SECONDS` | `8` | ระยะห่างระหว่าง request ของผู้ใช้คนเดียวกัน |

วันของโควต้าตัดที่เที่ยงคืนเวลา `America/Los_Angeles` (ตรงกับรอบรีเซ็ต RPD ของ Gemini API) ซึ่งตอนเวลาออมแสงของสหรัฐฯ = 14:00 น. เวลาไทย และ 15:00 น. หลังเปลี่ยนเวลา ข้อความ error ที่แสดงผู้ใช้คำนวณเวลาให้เอง

การ retry: เจอ 500/503/504 จะลองซ้ำ 1 ครั้งต่อรุ่น (กินโควต้า Gemini เพิ่ม)

## Log การใช้โทเคน

ทุกครั้งที่เรียก Gemini ฟังก์ชันเขียนบรรทัดเดียวลง log ดูที่ Supabase → Edge Functions → `scoreboard-ocr` → Logs ค้นหา `scoreboard-ocr usage`:

```
scoreboard-ocr usage {"model":"...","images":3,"ok":true,"ms":4200,"promptTokens":...,"outputTokens":...,"thoughtTokens":...,"totalTokens":...}
```

กรณี Gemini ล้มเหลวจะมี `"ok":false` และ `status` แทนตัวเลขโทเคน มีเฉพาะตัวเลข ไม่มีข้อมูลผู้ใช้หรือรูป ใช้ดู (1) โทเคนต่อรูป เทียบ TPM 250k (2) `thoughtTokens` ว่าโมเดลคิดเยอะผิดปกติไหม (3) เวลาตอบเมื่อส่งหลายรูป

## Activity (Admin Dashboard)

ใช้ `trackActivity()` และตาราง `user_activity_events` เดิม (ไม่มี RPC ใหม่ ชื่อ event แสดงจาก `EVENT_META` ใน `pages/AdminDashboard.tsx` กลุ่ม "Match Analysis")

| event | metadata | บันทึกเมื่อ |
| --- | --- | --- |
| `match_analysis_attempted` | `{ ok }` | ต่อรูปที่ถูกส่งไปวิเคราะห์ (`ok` ตามผลของรูปนั้น) รูปที่ถูกปฏิเสธบนเครื่องไม่นับ |
| `match_saved` | `{ edited }` | **หลัง** insert `match_results` สำเร็จเท่านั้น |

## Privacy

- รูปถูกส่งให้ Google Gemini API เท่านั้น ไม่เก็บใน Storage (ปรับข้อความใน Privacy Policy แล้ว)
- ตัดแถบ UID ฝั่ง client ก่อนส่ง แต่รูปยังมีชื่อในเกมของผู้เล่นอื่น จึงไม่บันทึกชื่อเหล่านั้นลงฐานข้อมูล และไม่ใส่ลง metadata ของ activity
- ถ้าใช้ Gemini free tier ให้ตรวจเงื่อนไขการใช้ข้อมูลของ Google ก่อนเปิดให้ผู้ใช้จริง (ผู้ใช้ส่งรูปที่มีชื่อบุคคลอื่น)

## Known limitations

- **ยังไม่วัดความแม่นของ OCR** (รวมถึงตอนส่งหลายรูปพร้อมกัน) ตัวเลขเล็ก ๆ ตัวหนังสือไทย ความละเอียดต่างเครื่อง ยังไม่เคยทดสอบ คอลัมน์ `match_results.ocr_edited` เป็นแค่ตัวชี้วัดคร่าว ๆ เพราะนับรวมการแก้ที่ไม่ใช่ OCR อ่านผิด เช่น เลือกฮีโร่ชื่อซ้ำหรือเลือกแถวของตัวเอง
- ไอเทมยังไม่ถูกอ่าน (ไอคอนล้วน ต้องจับคู่กับรูปไอคอนในตาราง `items`)
- รูปหน้าสรุปไม่มีข้อมูลรายนาที จึงวิเคราะห์ได้ระดับแมตช์เท่านั้น (ไม่รู้ว่าตายช่วงไหน)
- Coach Ai ยังไม่อ่านแมตช์ของผู้ใช้
- ยังไม่มีการกรอกแมตช์ด้วยมือ และไม่มี UPDATE (แก้ผิดให้ลบแล้วบันทึกใหม่)
- `played_at` เป็นเวลาที่ปรากฏบนหน้าจอเกม (ไม่มี time zone)
- ไม่มี automated test (โปรเจกต์ยังไม่มี test runner) ฟังก์ชันใน `features/matches/scan.ts` และ `stats.ts` เป็น pure function เพื่อให้เพิ่มเทสต์ภายหลังได้ง่าย
