import { useEffect } from "react";

export const SITE_URL = "https://rovlab.vercel.app";

export interface Crumb {
  name: string;
  /** path เช่น "/heroes" */
  path: string;
}

export interface DocMeta {
  title: string;
  description: string;
  /** path ของหน้า เช่น "/heroes/airi" (ใช้สร้าง canonical / og:url) */
  path: string;
  /** ถ้าใส่ จะสร้าง JSON-LD BreadcrumbList ให้ */
  breadcrumbs?: Crumb[];
}

const LD_ID = "ld-breadcrumb";

function upsert(tag: "meta" | "link", key: string, keyValue: string, attr: "content" | "href", value: string) {
  let el = document.head.querySelector<HTMLElement>(`${tag}[${key}="${keyValue}"]`);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(key, keyValue);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setBreadcrumbs(items?: Crumb[]) {
  document.getElementById(LD_ID)?.remove();
  if (!items?.length) return;
  const s = document.createElement("script");
  s.id = LD_ID;
  s.type = "application/ld+json";
  s.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: SITE_URL + c.path,
    })),
  });
  document.head.appendChild(s);
}

/** อัปเดต title / description / canonical / og / twitter / JSON-LD ผ่าน DOM (Google รัน JavaScript แล้วอ่านค่าเหล่านี้ได้) */
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
  setBreadcrumbs(m.breadcrumbs);
}

/** ใช้ในหน้าที่มีข้อมูลแบบ dynamic เช่น HeroDetail; ส่ง null เมื่อยังโหลดไม่เสร็จ */
export function useDocumentMeta(m: DocMeta | null) {
  const title = m?.title;
  const description = m?.description;
  const path = m?.path;
  const crumbsKey = m?.breadcrumbs ? JSON.stringify(m.breadcrumbs) : "";
  useEffect(() => {
    if (title && description && path) {
      applyDocumentMeta({
        title,
        description,
        path,
        breadcrumbs: crumbsKey ? (JSON.parse(crumbsKey) as Crumb[]) : undefined,
      });
    }
  }, [title, description, path, crumbsKey]);
}
