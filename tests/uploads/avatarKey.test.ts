import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarKey, avatarPublicUrl, ownAvatarKey } from "../../supabase/functions/_shared/avatarKey.ts";

const BASE = "https://assets.rovlab.app";
const ME = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER = "9b2f1c64-1111-4222-8333-444455556666";

test("new avatar key is always under the caller's own id and maps to an assets.rovlab.app URL", () => {
  const key = avatarKey(ME, 1792800000000, "jpg");
  assert.equal(key, `avatars/${ME}/1792800000000.jpg`);
  assert.equal(avatarPublicUrl(BASE + "/", key), `${BASE}/${key}`);
});
test("ownAvatarKey returns the key for the user's own R2 avatar", () => {
  assert.equal(ownAvatarKey(`${BASE}/avatars/${ME}/1792601038213.jpg`, ME, BASE), `avatars/${ME}/1792601038213.jpg`);
});
test("a user can never delete another user's avatar, Google photos, Supabase objects, or traversal paths", () => {
  for (const url of [
    `${BASE}/avatars/${OTHER}/1792601038213.jpg`, // someone else's
    `${BASE}/avatars/${ME}/../${OTHER}/1792601038213.jpg`,
    `${BASE}/avatars/${ME}/1792601038213.gif`,
    `${BASE}/announcements/${ME}.jpg`,
    `https://evil.test/avatars/${ME}/1792601038213.jpg`,
    `https://mttcdaiwuasnkqlxbeqs.supabase.co/storage/v1/object/public/avatars/${ME}/1792601038213.jpg`,
    "https://lh3.googleusercontent.com/a/ACg8ocK0=s96-c",
    "", null, undefined,
  ]) assert.equal(ownAvatarKey(url as string, ME, BASE), null, String(url));
  assert.equal(ownAvatarKey(`${BASE}/avatars/x/1792601038213.jpg`, "x", BASE), null, "non-uuid user id");
});
