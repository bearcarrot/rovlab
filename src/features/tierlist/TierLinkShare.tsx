import { useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { PublishShareDialog } from "@/features/share/PublishShareDialog";
import { ShareLinkButton, type ShareLink } from "@/features/share/ShareLinkButton";
import { buildShareUrl, shareOrCopyLink } from "@/features/share/shareLink";
import { saveTierList } from "@/services/userTierLists";
import { communityTierListIdFor, publishTierListForLink } from "@/services/shareLinks";
import type { CustomTierList } from "./customTierList";
import { sigOf, type CloudState } from "./cloudTierList";

// "แชร์ลิงก์" ของ Tier List ของฉัน: ลิงก์ = /tier-list/<id ของ Community Tier List> ต้องเข้าสู่ระบบ
// ยังไม่ได้บันทึก/ไม่ได้เผยแพร่/แก้ไขหลังเผยแพร่ → ถามยืนยันแล้วบันทึก + เผยแพร่ (หรืออัปเดตเวอร์ชัน) ก่อน
export function TierLinkShare({
  cloud,
  list,
  name,
  patch,
  dirty,
  empty,
  onPublished,
  onNeedLogin,
}: {
  cloud: CloudState;
  list: CustomTierList;
  name: string;
  patch: string;
  dirty: boolean;
  empty: boolean;
  onPublished: (c: CloudState) => void;
  onNeedLogin: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = useRef<{ id: string; communityId: string } | null>(null);
  const isPublic = cloud.id !== null && cloud.visibility === "public";

  const linkFor = (communityId: string): ShareLink => ({ url: buildShareUrl("/tier-list", communityId), title: name });

  function build(): ShareLink | null | undefined | Promise<ShareLink | null | undefined> {
    if (!user) {
      onNeedLogin();
      return undefined;
    }
    const id = cloud.id;
    if (id === null || !isPublic || dirty) {
      setDialog(true);
      return undefined;
    }
    if (known.current?.id === id) return linkFor(known.current.communityId); // sync: keeps the click gesture
    return communityTierListIdFor(id).then((communityId) => {
      if (!communityId) {
        setDialog(true); // it was unpublished elsewhere
        return undefined;
      }
      known.current = { id, communityId };
      return linkFor(communityId);
    });
  }

  async function confirm() {
    if (!user) return;
    setBusy(true);
    try {
      const listPatch = (cloud.patch || patch).trim();
      const savedId = await saveTierList({
        userId: user.id,
        id: cloud.id,
        name,
        description: cloud.description,
        patch: listPatch,
        visibility: isPublic ? "public" : "private",
        data: list.tiers,
      });
      const communityId = await publishTierListForLink(savedId);
      onPublished({ id: savedId, description: cloud.description, patch: listPatch, visibility: "public", savedSig: sigOf(list) });
      known.current = { id: savedId, communityId };
      setDialog(false);
      const link = linkFor(communityId);
      const outcome = await shareOrCopyLink(link.url, link.title);
      if (outcome === "copied") toast.success("เผยแพร่แล้ว และคัดลอกลิงก์แล้ว");
      else if (outcome === "failed") {
        toast.success("เผยแพร่แล้ว");
        window.prompt("คัดลอกลิงก์นี้", link.url);
      } else toast.success("เผยแพร่แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ShareLinkButton build={build} disabled={empty} />
      {dialog && (
        <PublishShareDialog
          noun="Tier List"
          fixedName={name}
          updating={isPublic}
          busy={busy}
          onCancel={() => setDialog(false)}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  );
}
