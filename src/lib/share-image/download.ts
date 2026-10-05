export function makeFilename(prefix: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.png`;
}

export function formatGeneratedDate(now = new Date()): string {
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** ดาวน์โหลดโดยไม่เปิดหน้าใหม่ */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
