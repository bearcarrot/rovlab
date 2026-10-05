import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { downloadBlob, renderImage, shareImage, type ImageTemplate } from "@/lib/share-image";

/**
 * Flow: กดแชร์ → สร้าง PNG → Web Share → (ไม่รองรับ) ดาวน์โหลด
 * - กันกดซ้ำระหว่างสร้างรูป
 * - ถ้า iOS/เบราว์เซอร์ปฏิเสธ share() เพราะสร้างรูปนานจนหมดสิทธิ์ user gesture
 *   จะเก็บรูปไว้ แล้วให้แตะ "แตะเพื่อแชร์" อีกครั้งโดยไม่ต้องสร้างใหม่
 * - ผลลัพธ์แจ้งด้วย toast กลาง (สถานะ "กำลังสร้างรูป..." ดูจากปุ่ม busy)
 */
export function useShareImage<T>(template: ImageTemplate<T>, build: () => { data: T; filename: string; title: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ blob: Blob; filename: string; title: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const finish = useCallback(
    (outcome: Awaited<ReturnType<typeof shareImage>>) => {
      if (outcome === "blocked") {
        setPending(true);
        toast.info("รูปพร้อมแล้ว แตะ \"แตะเพื่อแชร์\" อีกครั้ง");
        return;
      }
      pendingRef.current = null;
      setPending(false);
      if (outcome === "shared") toast.success("เปิดเมนูแชร์แล้ว");
      else if (outcome === "downloaded") toast.success("ดาวน์โหลดรูปแล้ว");
      // "cancelled" = ผู้ใช้ยกเลิกเอง ไม่ต้องแจ้งอะไร
    },
    [toast]
  );

  const run = useCallback(
    async (mode: "share" | "download") => {
      if (busyRef.current) return;
      // แตะรอบสอง: ใช้รูปที่สร้างไว้ ต้องเรียก share ทันทีใน gesture นี้
      const held = pendingRef.current;
      if (mode === "share" && held) {
        finish(await shareImage(held.blob, held.filename, { title: held.title, downloadOnBlocked: true }));
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setPending(false);
      pendingRef.current = null;
      try {
        const { data, filename, title } = build();
        const result = await renderImage(template, data);
        if (mode === "download") {
          downloadBlob(result.blob, filename);
          toast.success(
            result.missingImages > 0 ? `ดาวน์โหลดรูปแล้ว (ไอคอน ${result.missingImages} ตัวโหลดไม่ได้ ใช้ตัวย่อแทน)` : "ดาวน์โหลดรูปแล้ว"
          );
        } else {
          pendingRef.current = { blob: result.blob, filename, title };
          const outcome = await shareImage(result.blob, filename, { title });
          if (outcome !== "blocked") pendingRef.current = null;
          finish(outcome);
        }
      } catch {
        toast.error("สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [build, finish, template, toast]
  );

  return {
    busy,
    pending,
    share: () => run("share"),
    download: () => run("download"),
  };
}
