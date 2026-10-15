// Text color (white or near-black) that stays readable on a user-chosen #RRGGBB background.
// Threshold keeps the default tier colors (incl. yellow A) white, like the official badges.
export function readableTextColor(hex: string): "#FFFFFF" | "#0A0B0E" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#0A0B0E" : "#FFFFFF";
}
