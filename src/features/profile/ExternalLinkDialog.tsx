import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { ContactAppIcon } from "@/features/profile/ContactAppIcon";
import { getContactApp } from "@/features/profile/contactApps";
import type { ContactLink } from "@/types/profile";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// Shown before leaving the site: the user sees the full URL and chooses to continue or cancel.
export function ExternalLinkDialog({ link, onClose }: { link: ContactLink | null; onClose: () => void }) {
  const app = link ? getContactApp(link.app) : null;
  const host = link ? hostOf(link.url) : "";
  const rest = link && host ? link.url.slice(link.url.indexOf(host) + host.length) : "";

  return (
    <Dialog.Root
      open={!!link}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-card border border-border bg-bg-surface p-5 shadow-xl focus:outline-none">
          {link && app && (
            <>
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="space-y-1">
                  <Dialog.Title className="font-display text-base font-semibold">คุณกำลังจะออกจาก RoV LAB</Dialog.Title>
                  <Dialog.Description className="text-sm text-text-muted">
                    ลิงก์นี้พาไปยังเว็บไซต์ภายนอกที่ RoV LAB ไม่ได้ควบคุม ตรวจสอบที่อยู่ลิงก์ก่อนตัดสินใจเปิด
                  </Dialog.Description>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-bg-raised p-3">
                <div className="flex items-center gap-2">
                  <ContactAppIcon app={link.app} className="h-7 w-7 shrink-0" />
                  <span className="text-sm font-medium">{app.label}</span>
                </div>
                <p className="select-all break-all text-sm text-text-muted">
                  https://<span className="font-semibold text-text">{host}</span>
                  {rest}
                </p>
              </div>

              <p className="text-[11px] text-text-faint">
                ลิงก์นี้ผ่านการตรวจว่าเป็นโดเมนทางการของ {app.label} แต่ปลายทางเป็นเนื้อหาที่ผู้ใช้ตั้งเอง อย่ากรอกรหัสผ่านหรือรหัส OTP
                และอย่าโอนเงินให้ใครที่ทักมาจากลิงก์นี้
              </p>

              <div className="flex gap-2">
                <Dialog.Close className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text">
                  ยกเลิก
                </Dialog.Close>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-fg"
                >
                  เปิดลิงก์
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
