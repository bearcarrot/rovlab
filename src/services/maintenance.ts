import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FetchResult, SaveInput } from "@/features/maintenance/schedule";

// Full Maintenance Mode. READ: public RPC (config + server clock). WRITES: SECURITY DEFINER RPCs that check is_admin() on the server.

export const MAINTENANCE_ERROR_TH: Record<string, string> = {
  FORBIDDEN: "ไม่มีสิทธิ์ทำรายการนี้",
  INVALID_SCHEDULE: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
  ALREADY_ENDED: "เวลาสิ้นสุดผ่านไปแล้ว",
  INVALID_TEXT: "ข้อความยาวเกินกำหนด",
};

export class MaintenanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MaintenanceError";
    this.code = code;
  }
}

// PostgREST puts the RAISE ... DETAIL value of our RPC errors in `details` (e.g. "FORBIDDEN").
function toError(error: { message?: string; details?: string | null }, fallback: string): MaintenanceError {
  const code = typeof error.details === "string" && /^[A-Z_]+$/.test(error.details) ? error.details : "UNKNOWN";
  return new MaintenanceError(code, MAINTENANCE_ERROR_TH[code] ?? (error.message || fallback));
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
}

type Row = {
  enabled?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  message?: string | null;
  eta_note?: string | null;
  server_now?: string;
};

export async function fetchMaintenance(): Promise<FetchResult> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("get_maintenance");
  if (error) throw toError(error, "โหลดสถานะการปรับปรุงระบบไม่สำเร็จ");
  const row = (Array.isArray(data) ? data[0] : data) as Row | null | undefined;
  if (!row || typeof row.server_now !== "string") throw new Error("invalid maintenance response");
  return {
    serverNow: row.server_now,
    config: {
      enabled: row.enabled === true,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      message: row.message ?? "",
      etaNote: row.eta_note ?? "",
    },
  };
}

export async function saveMaintenance(input: SaveInput): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.rpc("admin_save_maintenance", {
    p_enabled: input.enabled,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_message: input.message,
    p_eta_note: input.etaNote,
  });
  if (error) throw toError(error, "บันทึกไม่สำเร็จ");
}

export async function disableMaintenance(): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.rpc("admin_disable_maintenance");
  if (error) throw toError(error, "ปิดกำหนดการไม่สำเร็จ");
}
