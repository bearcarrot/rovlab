import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { communityError, getFollowerCount, getFollowState, setFollow } from "@/services/community";

// Follow / unfollow + follower count for the public profile page (/players/:id).
export function FollowButton({ targetId }: { targetId: string }) {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    getFollowerCount(targetId).then((n) => {
      if (!cancelled) setFollowers(n);
    });
    if (user) {
      getFollowState(user.id, targetId).then((v) => {
        if (!cancelled) setFollowing(v);
      });
    } else {
      setFollowing(false);
    }
    return () => {
      cancelled = true;
    };
  }, [targetId, user?.id, isConfigured]);

  if (!isConfigured) return null;

  async function toggle() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      await setFollow(user.id, targetId, next);
    } catch (e) {
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
      toast.error(communityError(e, next ? "ติดตามไม่สำเร็จ" : "เลิกติดตามไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          following
            ? "rounded-lg border border-border px-4 py-1.5 text-xs text-text-muted disabled:opacity-60"
            : "rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60"
        }
      >
        {following ? "กำลังติดตาม" : "ติดตาม"}
      </button>
      <span className="text-xs text-text-faint">ผู้ติดตาม {followers.toLocaleString()}</span>
    </div>
  );
}
