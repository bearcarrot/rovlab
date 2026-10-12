// ลำดับรายการที่ผู้ใช้เห็นอยู่ในหน้าคลังข้อมูลเกม (ตามตัวกรอง/การค้นหา/การจัดกลุ่มตอนนั้น)
// ส่งผ่าน router state จากการ์ด → หน้ารายละเอียด เพื่อให้กด ก่อนหน้า/ถัดไป ได้โดยไม่ต้องย้อนกลับไปหน้ารายการ
export interface NavEntry {
  to: string;
  name: string;
}
export interface CatalogNavState {
  nav: NavEntry[];
}
