const AVATAR_SIZE = 512;

/**
 * Center-crops the picked image to a square, resizes it to 512x512 and re-encodes it as JPEG.
 * Re-encoding through a canvas also strips EXIF metadata (e.g. GPS location) from the photo.
 * Returns the JPEG as a base64 string (without the data: prefix).
 */
export async function fileToAvatarBase64(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("ไฟล์ต้องเป็นรูปภาพ");
  if (file.size > 15 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกินไป (สูงสุด 15 MB)");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("อ่านไฟล์รูปไม่ได้ ลองใช้ไฟล์ JPEG หรือ PNG");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("เบราว์เซอร์ไม่รองรับการประมวลผลรูป");
  }
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white instead of black
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("แปลงรูปไม่สำเร็จ");

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}
