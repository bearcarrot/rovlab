# ดึงข้อมูลเกมจากหน้า Admin (game-fetch)

แทนหน้า `index.php` เดิมสำหรับ 3 อย่าง: `getranklist` (สถิติแรงก์), `getlatestadjustlist` (ประวัติปรับบาลานซ์) และสกิลของฮีโร่
อยู่ในแท็บ **นำเข้าข้อมูล** ของหน้า Admin (เลือกชนิด: สถิติแรงก์ / ปรับสมดุล / สกิล) แต่ละชนิดมีการ์ด "ดึงจากเกมโดยตรง" หรือเลือกไฟล์ JSON แล้วเข้าขั้นตอน parse → ตรวจทาน → ยืนยัน
- สถิติแรงก์ / ปรับสมดุล: RPC `admin_import_rank_list` / `admin_import_balance_changes` เดิม
- สกิล: บันทึกลง `hero_abilities` ตรง ๆ ด้วยสิทธิ์แอดมินเดิม (RLS `is_admin`) ไม่มี migration ใหม่ — จับคู่ฮีโร่ด้วย `heroes.hero_id`

```
หน้า Admin ──JWT──► Edge Function game-fetch ──► kgth-api.mobagarena.com
   │                 (is_admin + allowlist)
   └─ JSON ดิบ ◄─────┘ → parseRankList / parseAdjustList เดิม → พรีวิว → RPC
```

## ตั้งค่า (Supabase secrets)

| secret | ไว้ทำอะไร |
| --- | --- |
| `GAME_SKILLS_URL` (ไม่บังคับ) | URL https ของ API สกิล ค่าเริ่มต้น `https://kgth-api.mobagarena.com/api/hero/getskilllist` โฮสต์ต้องลงท้าย `.mobagarena.com` |
| `GAME_API_HEADERS` (ไม่บังคับ) | JSON ของ header คงที่เพิ่มเติม เท่ากับ `api_headers` ใน `config.php` เดิม (ไม่ควรใส่ `Msdk-Itopencodeparam` ที่นี่ — ดูหัวข้อ EP/itop คู่กัน) |
| `GAME_EP_HEADER` (ไม่บังคับ) | ชื่อ header ของ Encodeparam ค่าเริ่มต้น `Encodeparam` |
| `GAME_ITOP_HEADER` (ไม่บังคับ) | ชื่อ header ของ itop ค่าเริ่มต้น `Msdk-Itopencodeparam` |
| `GAME_HERO_HEADER` (ไม่บังคับ) | ชื่อ header ที่ใช้ส่ง `hero_id` ให้ API สกิล ค่าเริ่มต้น `hero_id` (ยังไม่ได้ยืนยันชื่อจริงจาก request ของเกม ถ้าไม่ตรงให้ตั้งค่านี้) |
| `EP_LIST_URL` (ไม่บังคับ) | URL https ของ `ep.json` ใช้กับโหมด "จาก URL" |
| `EP_LIST_KEY` (ไม่บังคับ) | ส่งเป็น `Authorization: Bearer` ไปกับ `EP_LIST_URL` |

Deploy: `supabase functions deploy game-fetch`

## EP และ itop คู่กัน

`Encodeparam` กับ `Msdk-Itopencodeparam` (itop) เป็นคู่จากเซสชันเดียวกัน ถ้าใช้ปนกันข้ามเซสชัน เกมจะตอบ `-5001 auth failed`
จึงส่ง itop ไปกับ EP แต่ละค่า แทนการล็อกค่าเดียวไว้ใน `GAME_API_HEADERS`:

- ไฟล์ `ep.json`: ใส่ `"itop"` ในแต่ละรายการ เช่น `[{"label":"EP A","value":"...","itop":"...","at":1760000000000}]`
- โหมดวางเอง: ช่องที่สองสำหรับ itop (ไม่บังคับ)
- โหมด URL: function หยิบ itop จาก `ep.json` บน URL เอง ไม่ส่งค่ากลับไปที่เบราว์เซอร์ (คืนแค่ว่ามีหรือไม่)
- ถ้าไม่มี itop คู่กัน EP จะใช้ค่าใน `GAME_API_HEADERS` แทน (พฤติกรรมเดิม) และหน้า admin จะเตือนในแถวตัวสลับ

ชุด header คงที่ (`Camp-Source`, `Camp-Authtype`, `Aov-Region`, `Aov-Language`, `Msdk-Gameid`, `Msdk-Channelid`, `Msdk-Os`, `logicworldid`, `areaid` ฟอร์มอยู่ใน `GAME_API_HEADERS` ต่อไป

## แหล่ง EP 3 แบบ

1. **วางเอง** — เก็บใน localStorage ของเบราว์เซอร์ (มีปุ่ม "ล้าง EP ที่จำไว้" ในการ์ด)
2. **ไฟล์ ep.json** — อ่านบนเบราว์เซอร์ ไม่อัปโหลดขึ้น server รองรับ `["a","b"]`, `[{"label","value","at"?,"itop"?}]`, `{"A":"..."}`
   ใส่ `at: Date.now()` ในแต่ละรายการได้ เพื่อให้หน้า admin แสดงอายุจริงและเตือนเมื่อเกิน 24 ชม. (ไม่ใส่ = นับจากเวลานำเข้า)
3. **จาก URL** — function โหลด `EP_LIST_URL` เอง (ส่ง Bearer `EP_LIST_KEY`, ไม่ตาม redirect) และคืนเฉพาะ label/อายุ/ท้ายค่า/มี itop ไหม
   หน้า admin ส่งแค่ลำดับที่เลือก ค่า EP จริงไม่ถึงเบราว์เซอร์

ห้ามวาง `ep.json` ใน repo หรือ `public/` — EP/itop ผูกกับเซสชัน ใครได้ไปก็ใช้ได้

## ความปลอดภัย

- เฉพาะแอดมิน (`is_admin` ด้วย JWT ผู้เรียก)
- client ส่งได้แค่ `kind` / `rank_key` / `hero_id` / EP (+ itop) — URL และ body ประกอบฝั่ง function
- EP และ itop ส่งเป็น header เท่านั้น ไม่ log ไม่เก็บ และถูกตัดออกจากข้อความผิดพลาดที่ส่งกลับ
- ฝั่งเบราว์เซอร์จำ EP/itop ไว้ใน localStorage (ค่าเต็ม) ใช้ปุ่ม "ล้าง EP ที่จำไว้" เมื่อใช้เครื่องที่ใช้ร่วมกัน

## ตรวจว่ายิงตรงผ่านไหม

หลังดึงสำเร็จ Toast จะบอก `ดึงจากเกมแล้ว (direct · … ms)` ถ้าเกมปฏิเสธคำขอจาก Supabase (Toast ขึ้น `เกมตอบ HTTP 403 …` หรือเชื่อมต่อไม่ได้ ทั้งที่ EP ยังใหม่)
ให้ตรวจว่า itop คู่กับ EP ก่อน (`-5001 auth failed` มักเกิดจาก itop คนละเซสชัน) ถ้ายังไม่ผ่านจึงใช้ relay บนโฮสต์ PHP แทน (ยังไม่ได้ทำ)

## สกิล

- ดึงฮีโร่ที่เลือก หรือ "ดึงทุกตัว" ทีละตัว (หน่วง 0.4 วินาที) กดหยุดได้ และหยุดเองทันทีที่เกมปฏิเสธ แล้วส่งเท่าที่ได้ไปตรวจทาน
- `hero_id` ส่งทั้งใน body และใน header (ชื่อตาม `GAME_HERO_HEADER`)
- กติกาเหมือน `index.php`: เฉพาะช่อง passive (idx 0) และ 1-4, slot ซ้ำ (ร่างเสริม) เป็น `-ex`, `-ex2`, เรียงร่างปกติก่อนแล้วตามด้วยร่าง ex
- ต่างจาก `index.php` สองจุดเพื่อไม่ทำลายข้อมูล: (1) คงชื่อสกิลเดิมไว้ เว้นแต่ติ๊ "ทับชื่อสกิลเดิม" (2) ถ้าเกมไม่ส่งไอคอน จะคงไอคอนเดิมแทนที่จะทับเป็นว่าง
- ไม่ลบสกิลที่เกมไม่ส่งมาแล้ว
- รับไฟล์ `skills.json` ของ `index.php` เดิมได้

## ข้อความแจ้งผล

ผลของการดึง/นำเข้าแจ้งด้วย Toast อย่างเดียว (ไม่มีกล่องผลลัพธ์ inline ซ้ำ) ส่วนข้อความตรวจทานก่อนยืนยัน (จำนวนที่อ่านได้ ฮีโร่ที่จับคู่ไม่ได้) ยังอยู่ในหน้าเพราะต้องใช้ตัดสินใจ

## ยังไม่อยู่ในงานนี้

relay.php สำรอง (ยังไม่จำเป็น: ยิงตรงจาก Supabase ผ่านแล้ว), ถอด `index.php` และ service key ออกจากโฮสต์
