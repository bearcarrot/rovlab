import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy, LogIn, MessageCircle, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getHeroChipsByIds } from "@/services/heroes";
import { getPublicProfile } from "@/services/profile";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { HeroIcon } from "@/components/HeroIcon";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { FollowButton } from "@/features/community/FollowButton";
import { ContactLinksView } from "@/features/profile/ContactLinksView";
import { RoleBadges } from "@/features/profile/RoleChips";
import { creatorLabel } from "@/lib/creator";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(`คัดลอก${label}แล้ว`);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-raised px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-faint">{label}</p>
        <p className="break-words text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`คัดลอก${label}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-faint hover:text-accent"
      >
        {copied ? <Check className="h-4 w-4 text-win" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PlayerProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const valid = UUID_RE.test(id);
  const profileQ = useAsync(() => (valid ? getPublicProfile(id) : Promise.resolve(null)), [id]);
  // only the few favourite heroes are needed, not the whole hero list + stats
  const heroIds = profileQ.status === "success" && profileQ.data ? profileQ.data.preferredHeroes : [];
  const heroIdsKey = heroIds.join(",");
  const heroesQ = useAsync(() => getHeroChipsByIds(heroIds), [heroIdsKey]);

  if (profileQ.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-[7.5rem]" />
        <Skeleton className="h-40" />
        <Skeleton className="h-52" />
      </div>
    );
  }
  if (profileQ.status === "error") return <ErrorState message={profileQ.message} onRetry={profileQ.refetch} />;
  if (profileQ.status !== "success" || !profileQ.data) {
    return <EmptyState icon={UserRound} title="ไม่พบผู้เล่นนี้" description="ลิงก์อาจไม่ถูกต้อง หรือผู้ใช้นี้ไม่มีอยู่แล้ว" />;
  }

  const p = profileQ.data;
  const name = p.displayName?.trim() || "ผู้เล่นนิรนาม";
  const mine = user?.id === p.id;
  const favHeroes = heroesQ.status === "success" ? heroesQ.data : [];
  const since = p.createdAt ? new Date(p.createdAt) : null;
  const sinceText =
    since && !Number.isNaN(since.getTime()) ? since.toLocaleDateString("th-TH", { year: "numeric", month: "long" }) : "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-4">
      <div className="flex items-center gap-4 rounded-card border border-border bg-bg-surface p-4">
        <UserAvatar name={name} url={p.avatarUrl} eager className="h-20 w-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 font-display text-xl font-semibold">
            <span className="truncate">{name}</span>
            <VerifiedBadge category={p.verifiedCategory} className="[&>svg]:h-5 [&>svg]:w-5" />
          </h1>
          {p.verifiedCategory && <p className="text-xs text-text-muted">{creatorLabel(p.verifiedCategory)}</p>}
          {sinceText && <p className="text-xs text-text-faint">สมาชิกตั้งแต่ {sinceText}</p>}
          {mine && (
            <Link to="/profile" className="mt-1 inline-flex min-h-10 items-center text-sm text-accent">
              แก้ไขโปรไฟล์ →
            </Link>
          )}
          {!mine && <FollowButton targetId={p.id} />}
        </div>
      </div>

      {p.bio && (
        <Card>
          <CardHeader><CardTitle>แนะนำตัว</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap break-words text-sm text-text-muted">{p.bio}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>สไตล์การเล่น</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-text-faint">Role ที่ถนัด</p>
            {p.preferredRoles.length === 0 ? (
              <p className="text-sm text-text-faint">ยังไม่ได้ระบุ</p>
            ) : (
              <RoleBadges roles={p.preferredRoles} />
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-text-faint">ฮีโร่ที่ถนัด</p>
            {heroesQ.status === "loading" && heroIds.length > 0 && <Skeleton className="h-[5.75rem]" />}
            {(heroIds.length === 0 || (heroesQ.status === "success" && favHeroes.length === 0)) && (
              <p className="text-sm text-text-faint">ยังไม่ได้ระบุ</p>
            )}
            {favHeroes.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {favHeroes.map((h) => (
                  <Link
                    key={h.id}
                    to={`/heroes/${h.slug}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg-raised p-2 hover:border-accent/40"
                  >
                    <HeroIcon icon={h.icon} name={h.name} className="h-14 w-14" />
                    <span className="w-full truncate text-center text-xs">{h.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-accent" /><CardTitle>ช่องทางติดต่อ</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!user ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <LogIn className="h-4 w-4 shrink-0" />
                เข้าสู่ระบบเพื่อดูชื่อในเกมและช่องทางติดต่อ
              </p>
              <Link to="/login" className="inline-flex min-h-10 items-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
            </div>
          ) : !p.gameName && p.contactLinks.length === 0 ? (
            <p className="text-sm text-text-faint">ผู้เล่นยังไม่ได้ระบุชื่อในเกมหรือช่องทางติดต่อ</p>
          ) : (
            <>
              {p.gameName && <CopyRow label="ชื่อในเกม" value={p.gameName} />}
              <ContactLinksView links={p.contactLinks} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
