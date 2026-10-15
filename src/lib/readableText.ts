// Text color (white or near-black) with the higher WCAG contrast on a user-chosen #RRGGBB background.
// Picking the better of the two keeps the default tier colors (red/orange/yellow/green/blue) at >= 4.5:1 (AA).
const DARK = "#0A0B0E";
const DARK_LUM = 0.0033; // relative luminance of #0A0B0E

export function readableTextColor(hex: string): "#FFFFFF" | "#0A0B0E" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const withWhite = 1.05 / (lum + 0.05);
  const withDark = (lum + 0.05) / (DARK_LUM + 0.05);
  return withDark >= withWhite ? DARK : "#FFFFFF";
}
