import { supabase } from "@/lib/supabase";
import { functionErrorMessage } from "@/lib/functionError";

export interface GameIdentity {
  playerId: string; // the OpenID - only ever returned to its owner (RLS), never shown to other users
  ign: string;
  server: string | null;
  verifiedAt: string;
  refreshedAt: string;
}

export async function getMyGameIdentity(userId: string): Promise<GameIdentity | null> {
  const { data, error } = await supabase
    .from("game_identities")
    .select("player_id, ign, server, verified_at, refreshed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    playerId: data.player_id as string,
    ign: data.ign as string,
    server: (data.server as string | null) ?? null,
    verifiedAt: data.verified_at as string,
    refreshedAt: data.refreshed_at as string,
  };
}

// The name is looked up from the game by the `game-id` Edge Function and cannot be set from the client.
async function call(body: Record<string, unknown>, fallback: string): Promise<void> {
  const { error } = await supabase.functions.invoke("game-id", { body });
  if (error) throw new Error(await functionErrorMessage(error, fallback));
}

export const linkGameIdentity = (playerId: string) =>
  call({ action: "link", player_id: playerId }, "ผูกไอดีเกมไม่สำเร็จ");
export const refreshGameIdentity = () => call({ action: "refresh" }, "รีเฟรชชื่อไม่สำเร็จ");
export const unlinkGameIdentity = () => call({ action: "unlink" }, "ยกเลิกการผูกไม่สำเร็จ");
