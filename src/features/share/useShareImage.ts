import { useCallback, useEffect, useRef, useState } from "react";
import { downloadBlob, renderImage, shareImage, type ImageTemplate } from "@/lib/share-image";

export type ShareStatus = { kind: "info" | "success" | "error"; text: string } | null;

/**
 * Flow: กดแชร์ → สร้าง PNG → Web Share → (ไม่รองรับ) ดาวน์โหลด
 * - กันกดซ้ำระหว่างสร้างรูป
 * - ถ้า iOS/เบราว์เซอร์ปฏิเสธ share() เพราะสร้างรูปนานจนหมดสิทธิ์ user gesture
 *   จะเก็บรูปไว้ แล้วให้แตะ "แตะเพื่อแชร์" อีกครั้งโดยไม่ต้องสร้างใหม่
 */
export function useShareImage<T>(template: ImageTemplate<T>, build: () => { data: T; filename: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ShareStatus>(null);
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ blob: Blob; filename: string; title: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const flash = useCallback((s: ShareStatus, ms = 4000) => {
    if (!mounted.current) return;
    setStatus(s);
    clearTimeout(timer.current);
    if (s && s.kind !== "info") timer.current = setTimeout(() => mounted.current && setStatus(null), ms);
  }, []);

  const finish = useCallback(
    (outcome: Awaited<ReturnType<typeof shareImage>>) => {
      if (outcome === "blocked") {
        setPending(true);
        flash({ kind: "info", text: "รูปพร้อมแล้ว แตะ \"แตะเพื่อแชร์\" อีกครั้ง" }, 0);
        return;
      }
      pendingRef.current = null;
      setPending(false);
      if (outcome === "shared") flash({ kind: "success", text: "เปิดเมนูแชร์แล้ว" });
      else if (outcome === "downloaded") flash({ kind: "success", text: "ดาวน์โหลดรูปแล้ว" });
      else setStatus(null); // ผู้ใช้ยกเลิกเอง ไม่ต้องแจ้งอะไร
    },
    [flash]
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
      flash({ kind: "info", text: "กำลังสร้างรูป..." }, 0);
      try {
        const { data, filename, title } = build();
        const result = await renderImage(template, data);
        if (mode === "download") {
          downloadBlob(result.blob, filename);
          flash({
            kind: "success",
            text: result.missingImages > 0 ? `ดาวน์โหลดรูปแล้ว (ไอคอน ${result.missingImages} ตัวโหลดไม่ได้ ใช้ตัวย่อแทน)` : "ดาวน์โหลดรูปแล้ว",
          });
        } else {
          pendingRef.current = { blob: result.blob, filename, title };
          const outcome = await shareImage(result.blob, filename, { title });
          if (outcome !== "blocked") pendingRef.current = null;
          finish(outcome);
        }
      } catch {
        flash({ kind: "error", text: "สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง" }, 6000);
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [build, finish, flash, template]
  );

  return {
    busy,
    status,
    pending,
    share: () => run("share"),
    download: () => run("download"),
  };
}
