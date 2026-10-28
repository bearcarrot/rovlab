import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getAccountCount } from "@/services/publicStats";

// Compact social-proof line under the Hero. The count is the number of registered accounts (not active users), rounded down
// to hundreds by the server. While loading we reserve one line of height (no layout shift); if there is no valid value the
// whole line is removed instead of showing an invented number.
export function AccountCountLine() {
  const [count, setCount] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void getAccountCount().then((v) => {
      if (alive) setCount(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (count === null) return null;

  return (
    <p className="flex min-h-6 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-sm text-text-muted">
      {count !== undefined && (
        <>
          <Users className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
          <span>
            <span className="font-display font-semibold tabular-nums text-accent">{count.toLocaleString("en-US")}+</span>{" "}
            บัญชีผู้ใช้
          </span>
          <span aria-hidden="true" className="text-text-faint">
            ·
          </span>
          <span>ใช้งานฟรี</span>
          <span aria-hidden="true" className="text-text-faint">
            ·
          </span>
          <span>พัฒนาเพื่อชุมชน RoV</span>
        </>
      )}
    </p>
  );
}
