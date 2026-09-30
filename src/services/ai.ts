import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function askCoach(prompt: string, context?: unknown): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("ai-coach", {
    body: { prompt, context },
  });
  if (error) throw error;
  return (data?.text as string) ?? "";
}
