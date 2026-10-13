import { PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { useAsync } from "@/hooks/useAsync";
import { getHeroVideos } from "@/services/heroVideos";
import { timeAgo } from "@/lib/timeAgo";

const dateTh = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

// วิดีโอแนะนำล่าสุดของฮีโร่จาก YouTube (ลิงก์ออกไปดูที่ YouTube ไม่ฝัง player)
export function HeroVideos({ slug, name }: { slug: string; name: string }) {
  const q = useAsync(() => getHeroVideos(slug), [slug]);
  const d = q.status === "success" ? q.data : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-accent" />
          <CardTitle>วิดีโอแนะนำล่าสุด {name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.status === "loading" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        )}
        {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}

        {d && d.status !== "ok" && (
          <p className="text-sm text-text-faint">
            {d.status === "not_configured" ? "ยังไม่เปิดใช้งานวิดีโอแนะนำ" : "ตอนนี้โหลดวิดีโอจาก YouTube ไม่ได้ (โควต้าเต็มหรือบริการขัดข้อง) ลองใหม่ภายหลัง"}
          </p>
        )}

        {d && d.status === "ok" && d.videos.length === 0 && (
          <p className="text-sm text-text-faint">ยังไม่พบวิดีโอล่าสุดที่เกี่ยวกับ {name} ที่ยืนยันความเกี่ยวข้องได้</p>
        )}

        {d && d.status === "ok" && d.videos.length > 0 && (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.videos.map((v) => (
                <li key={v.id}>
                  <a
                    href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-lg border border-border bg-bg-raised transition hover:border-accent/40"
                  >
                    <div className="aspect-video w-full bg-bg">
                      <img src={v.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium group-hover:text-accent">{v.title}</p>
                      <p className="truncate text-xs text-text-muted">{v.channel}</p>
                      <p className="text-[11px] text-text-faint">เผยแพร่ {dateTh(v.publishedAt)}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-text-faint">
              ตรวจกับ YouTube ล่าสุด {timeAgo(d.fetchedAt)}
              {d.stale ? " (ตอนนี้อัปเดตไม่ได้ จึงแสดงข้อมูลที่เก็บไว้)" : ""} · วิดีโอเป็นของผู้สร้างเนื้อหาบน YouTube ไม่ใช่ของ RoV LAB
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
