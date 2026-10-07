import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ImagePlus, LogIn, LogOut, Trash2, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { getProfile, removeAvatar, updateProfile, uploadAvatar } from "@/services/profile";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/components/ui/toast";
import { HandleCard } from "@/features/community/HandleCard";
import { FavoriteHeroesPicker } from "@/features/profile/FavoriteHeroesPicker";
import { ContactLinksEditor } from "@/features/profile/ContactLinksEditor";
import { GameIdentityCard } from "@/features/profile/GameIdentityCard";
import { RoleMultiSelect } from "@/features/profile/RoleChips";
import { fileToAvatarBase64 } from "@/lib/image";
import { cn } from "@/lib/utils";
import { PROFILE_LIMITS } from "@/types/profile";
import type { ContactLink, Profile as ProfileData } from "@/types/profile";
import type { HeroSummary } from "@/types/hero";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent/60";

function Field({ label, hint, counter, children }: { label: string; hint?: string; counter?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        {counter && <span className="text-[11px] text-text-faint">{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-text-faint">{hint}</p>}
    </div>
  );
}

function ProfileForm({ profile, heroes, email }: { profile: ProfileData; heroes: HeroSummary[]; email: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [savedName, setSavedName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [contactLinks, setContactLinks] = useState<ContactLink[]>(profile.contactLinks);
  const [roles, setRoles] = useState<string[]>(profile.preferredRoles);
  const [heroIds, setHeroIds] = useState<string[]>(
    profile.preferredHeroes.filter((id) => heroes.some((h) => h.id === id))
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);

  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<"upload" | "remove" | null>(null);

  const emailPrefix = (email.split("@")[0] ?? "").toLowerCase();
  const nameFromEmail = emailPrefix !== "" && savedName.trim().toLowerCase() === emailPrefix;
  const shownName = savedName.trim() || "ผู้เล่น";

  function toggleRole(role: string) {
    setRoles((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        displayName,
        bio,
        contactLinks,
        preferredRoles: roles,
        preferredHeroes: heroIds,
      });
      setSavedName(displayName.trim());
      toast.success("บันทึกโปรไฟล์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setAvatarBusy("upload");
    try {
      const b64 = await fileToAvatarBase64(file);
      const url = await uploadAvatar(b64);
      setAvatarUrl(url);
      toast.success("อัปโหลดรูปแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setAvatarBusy(null);
    }
  }

  async function onRemoveAvatar() {
    setAvatarBusy("remove");
    try {
      await removeAvatar();
      setAvatarUrl(null);
      toast.success("ลบรูปแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setAvatarBusy(null);
    }
  }

  const nameTooShort = displayName.trim().length < PROFILE_LIMITS.displayNameMin;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <UserAvatar name={shownName} url={avatarUrl} className="h-20 w-20 text-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="truncate font-display text-lg font-semibold">{shownName}</p>
            <p className="truncate text-xs text-text-faint">{email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy !== null}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-bg-raised disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {avatarBusy === "upload" ? "กำลังตรวจสอบรูป..." : "เปลี่ยนรูป"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                disabled={avatarBusy !== null}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-loss hover:bg-bg-raised disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ลบรูป
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-text-faint">
        รูปจะถูกตรวจสอบอัตโนมัติก่อนแสดง ไม่รับรูปโป๊ รุนแรง หรือไม่เหมาะสม (ระบบตรวจด้วย AI อาจผิดพลาดได้)
      </p>

      <Link to={`/players/${profile.id}`} className="block text-sm text-accent">
        ดูโปรไฟล์สาธารณะของฉัน →
      </Link>

      <HandleCard userId={profile.id} />

      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-4">
        {nameFromEmail && (
          <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
            ชื่อที่แสดงตอนนี้มาจากอีเมลของคุณ และจะปรากฏในความคิดเห็นและโปรไฟล์สาธารณะ แนะนำให้เปลี่ยนเป็นชื่อเล่นหรือชื่อในเกม
          </p>
        )}
        <Field
          label="ชื่อที่แสดง"
          counter={`${displayName.trim().length}/${PROFILE_LIMITS.displayNameMax}`}
          hint="แสดงในความคิดเห็นและโปรไฟล์สาธารณะ"
        >
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={PROFILE_LIMITS.displayNameMax}
            placeholder="เช่น ชื่อเล่น หรือชื่อในเกม"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="แนะนำตัว" counter={`${bio.length}/${PROFILE_LIMITS.bio}`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={PROFILE_LIMITS.bio}
            rows={3}
            placeholder="เช่น เล่นช่วงกลางคืน ชอบเล่นสายซัพพอร์ต หาเพื่อนเล่นแรงค์"
            className={cn(INPUT_CLASS, "resize-none")}
          />
        </Field>

        <GameIdentityCard userId={profile.id} />

        <Field
          label="ช่องทางติดต่อ"
          hint="แสดงเฉพาะผู้ที่ล็อกอินเท่านั้น รับเฉพาะลิงก์ทางการของแอปที่เลือก และคนที่กดจะเห็นคำเตือนก่อนเปิดลิงก์"
        >
          <ContactLinksEditor value={contactLinks} onChange={setContactLinks} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Role ที่ถนัด</p>
          <RoleMultiSelect value={roles} onToggle={toggleRole} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            ฮีโร่ที่ถนัด <span className="text-xs font-normal text-text-faint">({heroIds.length}/{PROFILE_LIMITS.favoriteHeroes})</span>
          </p>
          <FavoriteHeroesPicker value={heroIds} onChange={setHeroIds} heroes={heroes} max={PROFILE_LIMITS.favoriteHeroes} />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || nameTooShort}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </button>
          {nameTooShort && (
            <p className="text-xs text-text-faint">ชื่อที่แสดงต้องยาวอย่างน้อย {PROFILE_LIMITS.displayNameMin} ตัวอักษร</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Profile() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();
  const profileQ = useAsync(() => (user ? getProfile(user.id) : Promise.resolve(null)), [user?.id]);
  const heroesQ = useAsync(() => getHeroes(), []);

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">โปรไฟล์</h1>
        <EmptyState icon={UserRound} title="ยังไม่ได้เชื่อม Supabase" description="ตั้งค่า .env เพื่อเปิดใช้งานระบบสมาชิก" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">โปรไฟล์</h1>
        <EmptyState icon={LogIn} title="ยังไม่ได้ล็อกอิน" description="เข้าสู่ระบบเพื่อดูและแก้ไขโปรไฟล์ของคุณ" />
        <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(profileQ.status === "loading" || heroesQ.status === "loading") && <Skeleton className="h-48" />}
      {profileQ.status === "error" && <ErrorState message={profileQ.message} onRetry={profileQ.refetch} />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {profileQ.status === "success" && heroesQ.status === "success" && profileQ.data && (
        <ProfileForm key={profileQ.data.id} profile={profileQ.data} heroes={heroesQ.data} email={user.email ?? ""} />
      )}

      <button
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm text-loss"
      >
        <LogOut className="h-4 w-4" />
        ออกจากระบบ
      </button>
    </div>
  );
}
