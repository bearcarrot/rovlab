import { useEffect } from "react";

export const SITE_URL = "https://rovlab.vercel.app";

export interface DocMeta {
  title: string;
  description: string;
  /** path ของหน้า เช่น "/heroes/airi" (ใช้สร้าง canonical / og:url) */
  path: string;
}

function upsert(tag: "meta" | "link", key: string, keyValue: string, attr: "content" | "href", value: string) {
  let el = document.head.querySelector<HTMLElement>(`${tag}[${key}="${keyValue}"]`);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(key, keyValue);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** อัปเดต title / description / canonical / og / twitter ผ่าน DOM (Google รัน JavaScript แล้วอ่านค่าเหล่านี้ได้) */
export function applyDocumentMeta(m: DocMeta) {
  const url = SITE_URL + m.path;
  document.title = m.title;
  upsert("meta", "name", "description", "content", m.description);
  upsert("link", "rel", "canonical", "href", url);
  upsert("meta", "property", "og:title", "content", m.title);
  upsert("meta", "property", "og:description", "content", m.description);
  upsert("meta", "property", "og:url", "content", url);
  upsert("meta", "name", "twitter:title", "content", m.title);
  upsert("meta", "name", "twitter:description", "content", m.description);
}

/** ใช้ในหน้าที่มีข้อมูลแบบ dynamic เช่น HeroDetail; ส่ง null เมื่อยังโหลดไม่เสร็จ */
export function useDocumentMeta(m: DocMeta | null) {
  const title = m?.title;
  const description = m?.description;
  const path = m?.path;
  useEffect(() => {
    if (title && description && path) applyDocumentMeta({ title, description, path });
  }, [title, description, path]);
}
