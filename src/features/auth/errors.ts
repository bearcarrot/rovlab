export function authErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case "invalid_credentials":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "email_not_confirmed":
      return "อีเมลนี้ยังไม่ได้ยืนยัน กรุณาตรวจสอบกล่องจดหมายหรือกดส่งอีเมลยืนยันอีกครั้ง";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "weak_password":
      return "รหัสผ่านไม่ปลอดภัยพอ กรุณาใช้ให้ยาวและเดายากขึ้น";
    case "same_password":
      return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม";
    case "validation_failed":
      return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    default:
      return fallback ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
}
