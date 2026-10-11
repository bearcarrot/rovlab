// Short, URL-friendly form of a DB uuid: 36 chars -> 22 chars (base64url of the 16 raw bytes).
//   3f2a9c1e-7b44-4d0a-9e1f-0c5d8a6b2e71  ->  PyqcHntETQqeHwxdimpucQ
// Pure functions, no network. Lets share links use the real Community row id without the long uuid.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT = /^[A-Za-z0-9_-]{22}$/;

export function uuidToShortId(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  let bin = "";
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Accepts the short id or a full uuid (so hand-made / old links still work). Returns null when it is neither. */
export function shortIdToUuid(id: string): string | null {
  if (UUID.test(id)) return id.toLowerCase();
  if (!SHORT.test(id)) return null;
  try {
    const bin = atob(id.replace(/-/g, "+").replace(/_/g, "/") + "==");
    if (bin.length !== 16) return null;
    const hex = Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}
