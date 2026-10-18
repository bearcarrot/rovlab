# ดึงข้อมูลเกมจากหน้า Admin (game-fetch)

แทนหน้า `index.php` เดิมสำหรับ 2 endpoint: `getranklist` (สถิติแรงก์) และ `getlatestadjustlist` (ประวัติปรับบาลานซ์)
การ์ด "ดึงจากเกมโดยตรง" อยู่ในหน้านำเข้าสถิติแรงก์และหน้านำเข้าปรับสมดุล ผลที่ได้เข้าขั้นตอน parse → พรีวิว → ยืนยัน → RPC `admin_import_*` เดิมทั้งหมด (ไม่มี migration ใหม่)

```
หน้า Admin ──JWT──► Edge Function game-fetch ──► kgth-api.mobagarena.com
   │                 (is_admin + allowlist)
   └─ JSON ดิบ ◄─────┘ → parseRankList / parseAdjustList เดิม → พรีวิว → RPC
```

## ตั้งค่า (Supabase secrets)

| secret | ไว้ทำอะไร |
| --- | --- |
| `GAME_API_HEADERS` (ไม่บังคับ) | JSON ของ header เพิ่มเติม เท่ากับ `api_headers` ใน `config.php` เดิม |
| `GAME_EP_HEADER` (ไม่บังคับ) | ชื่อ header ของ Encodeparam ค่าเริ่มต้น `Encodeparam` |
| `EP_LIST_URL` (ไม่บังคับ) | URL https ของ `ep.json` ใช้กับโหมด "จาก URL" |
| `EP_LIST_KEY` (ไม่บังคับ) | ส่งเป็น `Authorization: Bearer` ไปกับ `EP_LIST_URL` |

Deploy: `supabase functions deploy game-fetch`

## แหล่ง EP 3 แบบ

1. **วางเอง** — เก็บใน localStorage ของเบราว์เซอร์
2. **ไฟล์ ep.json** — อ่านบนเบราว์เซอร์ ไม่อัปโหลดขึ้น server รองรับ `["a","b"]`, `[{"label","value","at"?}]`, `{"A":"..."}`
   ใส่ `at: Date.now()` ในแต่ละรายการได้ เพื่อให้หน้า admin แสดงอายุจริงและเตือนเมื่อเกิน 24 ชม. (ไม่ใส่ = นับจากเวลานำเข้า)
3. **จาก URL** — function โหลด `EP_LIST_URL` เอง (ส่ง Bearer `EP_LIST_KEY`, ไม่ตาม redirect) และคืนเฉพาะ label/อายุ/ท้ายค่า
   หน้า admin ส่งแค่ลำดับที่เลือก ค่า EP จริงไม่ถึงเบราว์เซอร์

ห้ามวาง `ep.json` ใน repo หรือ `public/` — EP ผูกกับเซสชัน ใครได้ไปก็ใช้ได้

## ความปลอดภัย

- เฉพาะแอดมิน (`is_admin` ด้วย JWT ผู้เรียก)
- client ส่งได้แค่ `kind` / `rank_key` / EP — URL และ body ประกอบฝั่ง function
- EP ส่งเป็น header เท่านั้น ไม่ log ไม่เก็บ และถูกตัดออกจากข้อความผิดพลาดที่ส่งกลับ

## ตรวจว่ายิงตรงผ่านไหม

หลังดึง การ์ดจะแสดง `ผ่าน direct · เกมตอบ HTTP … · … ms` ถ้าเกมปฏิเสธคำขอจาก Supabase (HTTP 403 หรือเชื่อมต่อไม่ได้ ทั้งที่ EP ยังใหม่)
ให้ใช้ relay บนโฮสต์ PHP แทน (ยังไม่อยู่ใน PR นี้)

## ยังไม่อยู่ใน PR นี้

สกิล (hero_abilities), relay.php สำรอง, ถอด `index.php`
