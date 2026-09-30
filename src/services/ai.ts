import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function askCoach(prompt: string, context?: unknown): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("ai-coach", {
    body: { prompt, context },
  });
  if (error) {
    // functions.invoke ซ่อนข้อความจริงของ function ไว้ใน error.context (Response)
    const res = (error as { context?: unknown }).context;
    if (res instanceof Response) {
      const body = await res.json().catch(() => null);
      if (body?.error) throw new Error(String(body.error));
    }
    throw error;
  }
  return (data?.text as string) ?? "";
}
