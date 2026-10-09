import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// คำถามด่วนที่แต่ละหน้าลงทะเบียนไว้ให้ FAB โค้ช AI (ผู้ใช้พิมพ์เองไม่ได้ เลือกได้เฉพาะรายการนี้)
export type QuickChat = {
  id: string;
  /** ข้อความบนปุ่ม และเป็นข้อความฝั่งผู้ใช้ในแชท */
  label: string;
  /** prompt ที่ส่งให้ ai-coach */
  prompt: string;
  /** ข้อมูลของหน้านั้นที่ส่งให้ AI อ้างอิง */
  context?: unknown;
  /** เรียกเมื่อได้คำตอบจากโค้ช (เช่น หน้า Draft เอาไปใส่ในรูปแชร์) ไม่นับรวมใน signature จึงไม่ทำให้ลงทะเบียนซ้ำ */
  onAnswer?: (text: string) => void;
};

type Registration = { chats: QuickChat[]; resetKey: string };

const EMPTY: Registration = { chats: [], resetKey: "" };

// แยกเป็น 2 context: หน้าที่ลงทะเบียนใช้เฉพาะ actions (ค่าคงที่)
// จะไม่ re-render ตามทุกครั้งที่ state ของ FAB เปลี่ยน และไม่เกิด loop ลงทะเบียนซ้ำ
const StateCtx = createContext<Registration>(EMPTY);
const ActionsCtx = createContext<{ register: (r: Registration) => void; clear: () => void }>({
  register: () => {},
  clear: () => {},
});

export function CoachChatProvider({ children }: { children: ReactNode }) {
  const [reg, setReg] = useState<Registration>(EMPTY);
  const actions = useMemo(
    () => ({ register: (r: Registration) => setReg(r), clear: () => setReg(EMPTY) }),
    []
  );
  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={reg}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useCoachChatState() {
  return useContext(StateCtx);
}

/**
 * หน้าไหนเรียก hook นี้ FAB โค้ช AI จะโผล่ในหน้านั้น พร้อมคำถามด่วนที่ส่งมา
 * - resetKey: เปลี่ยนค่านี้ (เช่น slug ฮีโร่) เพื่อล้างบทสนทนาเก่า
 * - ส่ง chats เป็น [] ระหว่างข้อมูลยังโหลดไม่เสร็จได้ FAB จะยังไม่แสดง
 * - ออกจากหน้า (unmount) แล้วลงทะเบียนถูกล้างให้เอง
 * - ถ้า chats ถูก memo ไว้ (reference คงที่) จะไม่ต้อง stringify ใหม่ทุก render
 */
export function useCoachQuickChats(chats: QuickChat[], resetKey: string) {
  const { register, clear } = useContext(ActionsCtx);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  // เทียบด้วยเนื้อหา ไม่ใช่ reference: array ใหม่ทุก render จะไม่ทำให้ลงทะเบียนซ้ำ
  const signature = useMemo(() => JSON.stringify(chats), [chats]);

  useEffect(() => {
    if (chatsRef.current.length === 0) return undefined;
    register({ chats: chatsRef.current, resetKey });
    return clear;
  }, [signature, resetKey, register, clear]);
}
