import { MOCK_INSIGHTS } from "@/data/insights.mock";
import type { Insight } from "@/types/insight";

export async function getDashboardInsights(): Promise<Insight[]> {
  // TODO(supabase): replace with a query/derived view over the user's match history
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_INSIGHTS), 200));
}
