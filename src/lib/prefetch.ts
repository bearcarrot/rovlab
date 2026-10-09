import { getHeroes } from "@/services/heroes";
import { getLatestPatch } from "@/services/meta";
import { getFilterIcons } from "@/services/filterIcons";
import { getRecentBalance } from "@/services/balance";

// Start the first data requests as soon as the JS bundle runs, before React mounts and the providers initialise,
// instead of waiting for the page component's effects. Every call below is cached / shared with the page that
// asks for the same data later, so nothing is fetched twice. Only runs on pages that actually use this data.
const HERO_DATA_PATHS = new Set(["/", "/heroes", "/tier-list", "/stats", "/draft", "/counter-pick", "/matchup"]);

export function prefetchFirstPageData(pathname: string = window.location.pathname): void {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (!HERO_DATA_PATHS.has(path)) return;
  const ignore = () => undefined; // a failed prefetch is simply retried by the page itself (failures are not cached)
  void getLatestPatch().catch(ignore);
  void getHeroes().catch(ignore);
  void getFilterIcons().catch(ignore);
  void getRecentBalance().catch(ignore);
}
