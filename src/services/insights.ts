import { MOCK_INSIGHTS } from "@/data/insights.mock";
import type { Insight } from "@/types/insight";

export async function getDashboardInsights(): Promise<Insight[]> {
  // TODO(supabase): replace with a query/derived view over the user's match history
  // Resolve immediately: the old 200 ms setTimeout only simulated latency, and on the
  // home page this card text is the LCP element, so the delay was added straight to LCP.
  return MOCK_INSIGHTS;
}
