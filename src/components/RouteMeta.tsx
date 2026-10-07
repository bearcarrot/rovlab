import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyDocumentMeta } from "@/hooks/useDocumentMeta";

interface PageMeta {
  title: string;
  description: string;
}

const DEFAULT: PageMeta = {
  title: "RovLab — วิเคราะห์เกม RoV เพื่อเก่งขึ้นจริง",
  description: "RovLab: วิเคราะห์ Hero, Counter, Draft และ Build ของ RoV ด้วยข้อมูลจริง",
};

// หน้า static: ตั้ง title/description แยกรายหน้า (หน้า /heroes/:slug และ /learn/:slug ให้หน้านั้นตั้งเอง)
const PAGES: Record<string, PageMeta> = {
  "/": DEFAULT,
  "/heroes": {
    title: "ฮีโร่ RoV ทั้งหมด — สถิติ Win Rate Pick Rate Ban Rate | RovLab",
    description: "รวมฮีโร่ RoV ทุกตัว พร้อมสถิติ Win Rate, Pick Rate, Ban Rate ตำแหน่ง เลน และระดับความยาก",
  },
  "/tier-list": {
    title: "RoV Tier List — ฮีโร่ที่แข็งที่สุดตอนนี้ | RovLab",
    description: "จัดอันดับฮีโร่ RoV ตาม Tier จากข้อมูลจริง ดูว่าตัวไหนแข็งที่สุดในแพตช์ปัจจุบัน",
  },
  "/counter-pick": {
    title: "RoV Counter Pick — เลือกฮีโร่ชนะทางคู่ต่อสู้ | RovLab",
    description: "เลือกฮีโร่ที่ชนะทางศัตรูใน RoV ดูว่าตัวไหนแพ้ทางใคร พร้อมเหตุผล",
  },
  "/matchup": {
    title: "RoV Matchup — เปรียบเทียบฮีโร่ทีละคู่ | RovLab",
    description: "เปรียบเทียบฮีโร่ RoV สองตัว ดูว่าใครได้เปรียบในแมตช์อัปนั้น",
  },
  "/draft": {
    title: "RoV Draft Assistant — ช่วยวางแผนแบนและเลือกฮีโร่ | RovLab",
    description: "เครื่องมือช่วยวางแผน Draft ใน RoV แนะนำการแบนและการเลือกฮีโร่",
  },
  "/stats": {
    title: "สถิติ RoV — Win Rate Pick Rate Ban Rate | RovLab",
    description: "ดูสถิติฮีโร่ RoV ทั้งหมด จัดเรียงตาม Win Rate, Pick Rate และ Ban Rate",
  },
  "/learn": {
    title: "คู่มือ RoV — บทความสอนเล่น | RovLab",
    description: "บทความและคู่มือสอนเล่น RoV ตั้งแต่พื้นฐานไปจนถึงเทคนิคเพิ่มแรงค์",
  },
};

export function RouteMeta() {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isDynamicDetail = /^\/(heroes|learn)\/[^/]+$/.test(path);

  useEffect(() => {
    if (isDynamicDetail) return; // HeroDetail / GuideDetail ตั้ง meta เองหลังโหลดข้อมูล
    applyDocumentMeta({ ...(PAGES[path] ?? DEFAULT), path });
  }, [path, isDynamicDetail]);

  return null;
}
