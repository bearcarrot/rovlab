import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyDocumentMeta } from "@/hooks/useDocumentMeta";

interface PageMeta {
  title: string;
  description: string;
}

const DEFAULT: PageMeta = {
  title: "RoV LAB — วิเคราะห์เกม RoV เพื่อเก่งขึ้นจริง",
  description: "RoV LAB: วิเคราะห์ Hero, Counter, Draft และ Build ของ RoV ด้วยข้อมูลจริง",
};

// หน้า static: ตั้ง title/description แยกรายหน้า (หน้า /heroes/:slug ให้ HeroDetail ตั้งเอง)
const PAGES: Record<string, PageMeta> = {
  "/": DEFAULT,
  "/heroes": {
    title: "ฮีโร่ RoV ทั้งหมด — สถิติ Win Rate Pick Rate Ban Rate | RoV LAB",
    description: "รวมฮีโร่ RoV ทุกตัว พร้อมสถิติ Win Rate, Pick Rate, Ban Rate ตำแหน่ง เลน และระดับความยาก",
  },
  "/tier-list": {
    title: "RoV Tier List — ฮีโร่ที่แข็งที่สุดตอนนี้ | RoV LAB",
    description: "จัดอันดับฮีโร่ RoV ตาม Tier จากข้อมูลจริง ดูว่าตัวไหนแข็งที่สุดในแพตช์ปัจจุบัน",
  },
  "/counter-pick": {
    title: "RoV Counter Pick — เลือกฮีโร่ชนะทางคู่ต่อสู้ | RoV LAB",
    description: "เลือกฮีโร่ที่ชนะทางศัตรูใน RoV ดูว่าตัวไหนแพ้ทางใคร พร้อมเหตุผล",
  },
  "/matchup": {
    title: "RoV Matchup — เปรียบเทียบฮีโร่ทีละคู่ | RoV LAB",
    description: "เปรียบเทียบฮีโร่ RoV สองตัว ดูว่าใครได้เปรียบในแมตช์อัปนั้น",
  },
  "/draft": {
    title: "RoV Draft Assistant — ช่วยวางแผนแบนและเลือกฮีโร่ | RoV LAB",
    description: "เครื่องมือช่วยวางแผน Draft ใน RoV แนะนำการแบนและการเลือกฮีโร่",
  },
  "/stats": {
    title: "สถิติ RoV — Win Rate Pick Rate Ban Rate | RoV LAB",
    description: "ดูสถิติฮีโร่ RoV ทั้งหมด จัดเรียงตาม Win Rate, Pick Rate และ Ban Rate",
  },
  "/learn": {
    title: "คู่มือ RoV — บทความสอนเล่น | RoV LAB",
    description: "บทความและคู่มือสอนเล่น RoV ตั้งแต่พื้นฐานไปจนถึงเทคนิคเพิ่มแรงค์",
  },
};

export function RouteMeta() {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isHeroDetail = /^\/heroes\/[^/]+$/.test(path);

  useEffect(() => {
    if (isHeroDetail) return; // HeroDetail ตั้ง meta เองหลังโหลดข้อมูล
    applyDocumentMeta({ ...(PAGES[path] ?? DEFAULT), path });
  }, [path, isHeroDetail]);

  return null;
}
