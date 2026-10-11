import { useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { PublishShareDialog } from "@/features/share/PublishShareDialog";
import { ShareLinkButton, type ShareLink } from "@/features/share/ShareLinkButton";
import { buildShareUrl, shareOrCopyLink } from "@/features/share/shareLink";
import { DRAFT_NAME_MAX, saveDraft } from "@/services/draftSeries";
import { communityDraftIdFor, publishDraftForLink } from "@/services/shareLinks";
import type { DraftSessionApi } from "./useDraftSession";

// "แชร์ลิงก์" ของ Draft: ลิงก์ = /draft/<id ของ Community Draft> ต้องเข้าสู่ระบบ
// ถ้า Draft ยังไม่ได้บันทึก/ไม่ได้เผยแพร่/มีการแก้ไขหลังเผยแพร่ → ถามยืนยันแล้วบันทึก + เผยแพร่ (หรืออัปเดตเวอร์ชัน) ก่อน
export function DraftLinkShare({ ds, onNeedLogin }: { ds: DraftSessionApi; onNeedLogin: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = useRef<{ draftId: string; communityId: string } | null>(null);
  const isPublic = ds.draftId !== null && ds.visibility === "public";

  const linkFor = (communityId: string, title: string): ShareLink => ({
    url: buildShareUrl("/draft", communityId),
    title: title.trim() || "RoV LAB Draft",
  });

  function build(): ShareLink | null | undefined | Promise<ShareLink | null | undefined> {
    if (!user) {
      onNeedLogin();
      return undefined;
    }
    const draftId = ds.draftId;
    if (draftId === null || !isPublic || ds.dirty) {
      setDialog(true);
      return undefined;
    }
    if (known.current?.draftId === draftId) return linkFor(known.current.communityId, ds.title); // sync: keeps the click gesture
    return communityDraftIdFor(draftId).then((communityId) => {
      if (!communityId) {
        setDialog(true); // it was unpublished elsewhere
        return undefined;
      }
      known.current = { draftId, communityId };
      return linkFor(communityId, ds.title);
    });
  }

  async function confirm(name: string) {
    if (!user) return;
    setBusy(true);
    try {
      // keep the row's current visibility on save; publish_draft then creates v1 (private -> public) or a new version (public)
      const savedId = await saveDraft({
        userId: user.id,
        id: ds.draftId,
        name,
        description: ds.description,
        visibility: isPublic ? "public" : "private",
        series: ds.series,
      });
      const communityId = await publishDraftForLink(savedId);
      ds.markSaved({ draftId: savedId, title: name.trim(), description: ds.description, visibility: "public" });
      known.current = { draftId: savedId, communityId };
      setDialog(false);
      const link = linkFor(communityId, name);
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
      <ShareLinkButton build={build} disabled={ds.isBlank} />
      {dialog && (
        <PublishShareDialog
          noun="Draft"
          initialName={ds.title}
          nameMax={DRAFT_NAME_MAX}
          updating={isPublic}
          busy={busy}
          onCancel={() => setDialog(false)}
          onConfirm={(n) => void confirm(n)}
        />
      )}
    </>
  );
}
