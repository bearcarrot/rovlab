import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, FolderOpen, Save } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { withNext } from "@/features/auth/nav";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Modal } from "@/features/community/Modal";
import { saveTierList, type MyTierList } from "@/services/userTierLists";
import type { HeroSummary } from "@/types/hero";
import { CustomTierBoard } from "./CustomTierBoard";
import { DEFAULT_CUSTOM_NAME, clearCustom, createDefault, loadCustom, type CustomTierList } from "./customTierList";
import {
  EMPTY_CLOUD,
  editorHasUnsavedWork,
  fromMyList,
  readCloud,
  sigOf,
  toCustom,
  writeCloud,
  type CloudState,
} from "./cloudTierList";
import { MyTierLists } from "./MyTierLists";
import { SaveTierListDialog, type SaveTierListValues } from "./SaveTierListDialog";
import type { PresetLoad } from "./CommunityTierLists";

export interface IncomingPreset extends PresetLoad {
  nonce: number;
}

// Wraps the existing editor (CustomTierBoard, unchanged UX) with Save / My Tier Lists.
// The editor still autosaves locally; "บันทึก" stores it on the account, and it remembers which saved list it came from.
export function MyTierListWorkspace({
  heroes,
  patch,
  incoming,
}: {
  heroes: HeroSummary[];
  patch: string;
  incoming: IncomingPreset | null;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [boardKey, setBoardKey] = useState(0);
  const [initial, setInitial] = useState<CustomTierList | null>(null);
  const [current, setCurrent] = useState<CustomTierList>(() => loadCustom() ?? createDefault(patch));
  const [cloud, setCloudState] = useState<CloudState>(() => readCloud());
  const [showSaved, setShowSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginNotice, setLoginNotice] = useState(false);
  const lastNonce = useRef<number | null>(null);

  const setCloud = useCallback((c: CloudState) => {
    writeCloud(c);
    setCloudState(c);
  }, []);

  const dirty = cloud.id ? sigOf(current) !== cloud.savedSig : Object.values(current.tiers).some((l) => l.length > 0);
  const name = current.name.trim() || DEFAULT_CUSTOM_NAME;

  function replaceBoard(list: CustomTierList, nextCloud: CloudState) {
    setInitial(list);
    setBoardKey((k) => k + 1);
    setCurrent(list);
    setCloud(nextCloud);
  }

  // Load Preset from Community arrives here (the copy was already created and the unsaved-work prompt already shown).
  useEffect(() => {
    if (!incoming || lastNonce.current === incoming.nonce) return;
    lastNonce.current = incoming.nonce;
    const list = toCustom({ name: incoming.name, patch: incoming.patch, data: incoming.data });
    replaceBoard(
      list,
      incoming.cloudId
        ? { id: incoming.cloudId, description: incoming.description, patch: incoming.patch, visibility: "private", savedSig: sigOf(list) }
        : EMPTY_CLOUD
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  async function confirmReplace(): Promise<boolean> {
    if (!editorHasUnsavedWork()) return true;
    return confirm({
      title: "แทนที่ Tier List ปัจจุบัน?",
      message: "Tier List ปัจจุบันยังไม่ได้บันทึก ต้องการแทนที่ด้วยรายการที่เลือกหรือไม่?",
      confirmLabel: "แทนที่",
      danger: true,
    });
  }

  async function openSaved(l: MyTierList) {
    if (!(await confirmReplace())) return;
    const { list, cloud: c } = fromMyList(l);
    replaceBoard(list, c);
    setShowSaved(false);
    toast.success("โหลด Tier List แล้ว");
  }

  async function startNew() {
    if (!(await confirmReplace())) return;
    clearCustom();
    replaceBoard(createDefault(patch), EMPTY_CLOUD);
  }

  function onSaveClick() {
    if (!user) {
      setLoginNotice(true); // the editor autosaves locally, so nothing is lost
      return;
    }
    setSaveOpen(true);
  }

  async function doSave(v: SaveTierListValues, asCopy: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      const wasPublic = !asCopy && cloud.id !== null && cloud.visibility === "public";
      const id = await saveTierList({
        userId: user.id,
        id: asCopy ? null : cloud.id,
        name,
        description: v.description,
        patch: v.patch,
        visibility: v.visibility,
        data: current.tiers,
      });
      setCloud({ id, description: v.description.trim(), patch: v.patch.trim(), visibility: v.visibility, savedSig: sigOf(current) });
      setRefreshKey((k) => k + 1);
      setSaveOpen(false);
      if (v.visibility !== "public") toast.success("บันทึก Tier List แล้ว");
      else if (wasPublic) toast.success("บันทึกแล้ว — Community ยังเป็นเวอร์ชันเดิม กด “อัปเดต Community” ที่รายการของฉันเพื่อเผยแพร่เวอร์ชันนี้");
      else toast.success("บันทึกและเผยแพร่ไปยัง Community แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{name}</span>
          <span className="ml-2 text-xs text-text-faint">
            {cloud.id ? (cloud.visibility === "public" ? "บันทึกแล้ว · Public" : "บันทึกแล้ว · Private") : "ร่างในเครื่องนี้"}
          </span>
          {dirty && cloud.id && <span className="ml-2 text-xs text-amber-400">ยังไม่ได้บันทึกการแก้ไข</span>}
        </p>
        <button type="button" onClick={onSaveClick} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">
          <Save className="h-4 w-4" />
          บันทึก
        </button>
        <button
          type="button"
          aria-pressed={showSaved}
          onClick={() => setShowSaved((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text"
        >
          <FolderOpen className="h-4 w-4" />
          รายการของฉัน
        </button>
        <button type="button" onClick={() => void startNew()} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text">
          <FilePlus2 className="h-4 w-4" />
          ใหม่
        </button>
      </div>

      {showSaved && (
        <section aria-label="Tier List ของฉัน" className="space-y-2">
          <h2 className="font-display text-sm font-semibold">Tier List ของฉัน</h2>
          <MyTierLists
            heroes={heroes}
            currentId={cloud.id}
            refreshKey={refreshKey}
            onOpen={(l) => void openSaved(l)}
            onDeleted={(id) => {
              if (id === cloud.id) setCloud({ ...EMPTY_CLOUD }); // content stays in the editor, now unsaved
            }}
          />
        </section>
      )}

      <CustomTierBoard
        key={boardKey}
        heroes={heroes}
        patch={patch}
        initial={initial}
        onChange={setCurrent}
        onReset={() => setCloud({ ...EMPTY_CLOUD })}
      />

      {saveOpen && (
        <SaveTierListDialog
          name={name}
          initial={{ description: cloud.description, patch: cloud.patch || patch, visibility: cloud.visibility }}
          editing={cloud.id !== null}
          busy={saving}
          onCancel={() => setSaveOpen(false)}
          onSave={(v, asCopy) => void doSave(v, asCopy)}
        />
      )}
      {loginNotice && (
        <Modal title="เข้าสู่ระบบเพื่อบันทึก Tier List" onClose={() => setLoginNotice(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-text-muted">ต้องเข้าสู่ระบบก่อนบันทึก Tier List ไว้ในบัญชีของคุณ Tier List ที่กำลังจัดอยู่ยังเก็บไว้ในเครื่องนี้ ไม่หายเมื่อไปเข้าสู่ระบบ</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLoginNotice(false)} className="rounded-lg border border-border px-3 py-2 text-text-muted hover:text-text">
                ยกเลิก
              </button>
              <Link to={withNext("/login", "/tier-list")} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
