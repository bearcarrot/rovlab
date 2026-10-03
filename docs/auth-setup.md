# Auth setup (Supabase)

โค้ดฝั่งแอปจัดการ flow ทั้งหมดแล้ว แต่ค่าต่อไปนี้ต้องตั้งที่ Supabase Dashboard เอง

1. **Authentication → Providers → Email**: เปิด *Confirm email*
2. **Authentication → URL Configuration**: เพิ่ม Redirect URLs ของทุกโดเมนที่ใช้ (เช่น `http://localhost:5173/**` และโดเมน production) — ใช้กับลิงก์ยืนยันอีเมล, Google OAuth และ reset password (`/reset-password`)
3. **Authentication → SMTP**: ตั้ง SMTP ของตัวเองก่อนเปิดใช้งานจริง (SMTP เริ่มต้นของ Supabase จำกัดจำนวนอีเมลมาก)
4. **Authentication → Rate Limits**: ตั้งเพดานสำหรับ sign-up/sign-in, ส่งอีเมล, reset password — ปุ่ม Resend ฝั่งแอปมี cooldown 60 วินาที แต่เป็นแค่ UX ตัวจริงคือ rate limit ของ Supabase
5. **Authentication → Attack Protection**: เปิด CAPTCHA (Turnstile) เมื่อพร้อม *(ยังไม่ได้ต่อในแอป — ต้องส่ง `captchaToken` ใน signUp/signIn/reset)*
6. รัน `supabase/migrations/20261004_auth_username_verification.sql`

## พฤติกรรมที่ควรรู้
- เมื่อเปิด *Confirm email* Supabase จะ **ไม่ให้ session** กับผู้ใช้ที่ยังไม่ยืนยัน จึงล็อกอินไม่ได้จนกว่าจะยืนยัน หน้า Login จะแสดงปุ่ม Resend verification email ในกรณีนี้ ถ้าต้องการให้ล็อกอินได้ก่อนยืนยัน ต้องเปิดตัวเลือกที่อนุญาตให้ sign-in โดยไม่ยืนยันอีเมล (ถ้า dashboard ของโปรเจกต์มี) โค้ดรองรับทั้งสองแบบ และ RLS ของ `comments` บังคับ `email_confirmed_at` อยู่แล้ว
- สมัครด้วยอีเมลที่มีอยู่แล้ว Supabase จะไม่แจ้ง error (กันการเดาว่ามีบัญชี) หน้า Register จึงแสดงข้อความ "ตรวจสอบอีเมล" เหมือนกันทุกกรณี
- Forgot Password แสดงข้อความเดียวกันไม่ว่าอีเมลจะมีบัญชีหรือไม่
