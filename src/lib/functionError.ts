// supabase-js hides the real error body of a failed Edge Function call inside error.context (a Response).
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const res = (error as { context?: unknown } | null)?.context;
  if (res instanceof Response) {
    const body = await res.json().catch(() => null);
    if (body && typeof body.error === "string") return body.error;
  }
  return fallback;
}
