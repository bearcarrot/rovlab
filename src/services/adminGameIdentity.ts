import { supabase } from "@/lib/supabase";

export interface AdminGameIdentity {
  userId: string;
  handle: string | null;
  displayName: string | null;
  playerId: string; // OpenID — visible to admins only
  ign: string;
  server: string | null;
  verifiedAt: string;
  refreshedAt: string;
}

type Row = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  player_id: string;
  ign: string;
  server: string | null;
  verified_at: string;
  refreshed_at: string;
};

// Both RPCs check is_admin() on the server; non-admins get an error.
export async function adminSearchGameIdentities(query: string): Promise<AdminGameIdentity[]> {
  const { data, error } = await supabase.rpc("admin_search_game_identities", { p_query: query });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    playerId: r.player_id,
    ign: r.ign,
    server: r.server,
    verifiedAt: r.verified_at,
    refreshedAt: r.refreshed_at,
  }));
}

// Frees an OpenID that someone else linked. Returns false if nothing was linked to it any more.
export async function adminReleaseGameIdentity(playerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("admin_release_game_identity", { p_player_id: playerId });
  if (error) throw new Error(error.message);
  return data === true;
}
