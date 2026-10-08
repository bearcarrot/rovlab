import { lazy, type ComponentType, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { PageNav, type Crumb } from "@/components/layout/PageNav";
import { RouteMeta } from "@/components/RouteMeta";
import { RequireAuth } from "@/features/auth/RequireAuth";
// Home เป็นหน้าแรก/LCP จึง import แบบปกติ (ไม่ lazy) เพื่อไม่ให้เกิด request ซ้อนกัน
import { Home } from "@/pages/Home";

// หน้าอื่นทั้งหมดโหลดตามเส้นทาง (route-level code splitting) เพื่อลด JS ที่ไม่ได้ใช้ในหน้าแรก
// หน้าเหล่านี้ export แบบ named export จึงแปลงเป็น default ให้ React.lazy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyNamed<M extends Record<string, any>, K extends keyof M>(load: () => Promise<M>, name: K) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType<any> })));
}

const Heroes = lazyNamed(() => import("@/pages/Heroes"), "Heroes");
const HeroDetail = lazyNamed(() => import("@/pages/HeroDetail"), "HeroDetail");
const TierList = lazyNamed(() => import("@/pages/TierList"), "TierList");
const CounterPick = lazyNamed(() => import("@/pages/CounterPick"), "CounterPick");
const DraftAssistant = lazyNamed(() => import("@/pages/DraftAssistant"), "DraftAssistant");
const Matchup = lazyNamed(() => import("@/pages/Matchup"), "Matchup");
const Favorites = lazyNamed(() => import("@/pages/Favorites"), "Favorites");
const Profile = lazyNamed(() => import("@/pages/Profile"), "Profile");
const PlayerProfile = lazyNamed(() => import("@/pages/PlayerProfile"), "PlayerProfile");
const Login = lazyNamed(() => import("@/pages/Login"), "Login");
const Register = lazyNamed(() => import("@/pages/Register"), "Register");
const ForgotPassword = lazyNamed(() => import("@/pages/ForgotPassword"), "ForgotPassword");
const ResetPassword = lazyNamed(() => import("@/pages/ResetPassword"), "ResetPassword");
const Stats = lazyNamed(() => import("@/pages/Stats"), "Stats");
const Learn = lazyNamed(() => import("@/pages/Learn"), "Learn");
const GuideDetail = lazyNamed(() => import("@/pages/GuideDetail"), "GuideDetail");
const AdminHub = lazyNamed(() => import("@/pages/AdminHub"), "AdminHub");
const Notifications = lazyNamed(() => import("@/pages/Notifications"), "Notifications");
const Feed = lazyNamed(() => import("@/pages/Feed"), "Feed");
const UserByHandle = lazyNamed(() => import("@/pages/UserByHandle"), "UserByHandle");
const NotFound = lazyNamed(() => import("@/pages/NotFound"), "NotFound");
const PrivacyPolicy = lazyNamed(() => import("@/pages/Legal"), "PrivacyPolicy");
const TermsOfUse = lazyNamed(() => import("@/pages/Legal"), "TermsOfUse");
const Disclaimer = lazyNamed(() => import("@/pages/Legal"), "Disclaimer");
const DataSources = lazyNamed(() => import("@/pages/Legal"), "DataSources");
const CommunityGuidelines = lazyNamed(() => import("@/pages/Legal"), "CommunityGuidelines");

const HOME: Crumb = { label: "หน้าแรก", to: "/" };

// ใส่ปุ่มย้อนกลับ + breadcrumb ให้หน้าลูก/หน้านอกเมนูหลัก ที่ระดับ route
// ครอบทุกสถานะของหน้า (loading/error/ไม่พบ) โดยไม่ต้องแก้ไฟล์หน้าเดิม
function WithNav({ crumbs, fallback = "/", children }: { crumbs: Crumb[]; fallback?: string; children: ReactNode }) {
  return (
    <>
      <PageNav crumbs={crumbs} fallback={fallback} />
      {children}
    </>
  );
}

export default function App() {
  return (
    <>
    <RouteMeta />
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="heroes" element={<Heroes />} />
        <Route
          path="heroes/:slug"
          element={
            <WithNav crumbs={[HOME, { label: "ฮีโร่ทั้งหมด", to: "/heroes" }, { label: "รายละเอียดฮีโร่" }]} fallback="/heroes">
              <HeroDetail />
            </WithNav>
          }
        />
        <Route path="tier-list" element={<TierList />} />
        <Route path="counter-pick" element={<CounterPick />} />
        <Route path="matchup" element={<Matchup />} />
        <Route path="draft" element={<DraftAssistant />} />
        {/* หน้า Item Build ถูกนำออกแล้ว: ลิงก์/บุ๊กมาร์กเก่าให้กลับหน้าแรก */}
        <Route path="build" element={<Navigate to="/" replace />} />
        <Route path="stats" element={<Stats />} />
        <Route path="learn" element={<Learn />} />
        <Route
          path="learn/:slug"
          element={
            <WithNav crumbs={[HOME, { label: "คู่มือ", to: "/learn" }, { label: "บทความ" }]} fallback="/learn">
              <GuideDetail />
            </WithNav>
          }
        />
        <Route path="favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <WithNav crumbs={[HOME, { label: "การแจ้งเตือน" }]}><Notifications /></WithNav>
            </RequireAuth>
          }
        />
        <Route
          path="feed"
          element={
            <RequireAuth>
              <WithNav crumbs={[HOME, { label: "ฟีดคนที่ติดตาม" }]} fallback="/notifications"><Feed /></WithNav>
            </RequireAuth>
          }
        />
        <Route
          path="profile"
          element={
            <RequireAuth>
              <WithNav crumbs={[HOME, { label: "โปรไฟล์" }]}><Profile /></WithNav>
            </RequireAuth>
          }
        />
        <Route path="players/:id" element={<WithNav crumbs={[HOME, { label: "โปรไฟล์ผู้เล่น" }]}><PlayerProfile /></WithNav>} />
        <Route path="u/:handle" element={<UserByHandle />} />
        <Route path="login" element={<WithNav crumbs={[HOME, { label: "เข้าสู่ระบบ" }]}><Login /></WithNav>} />
        <Route path="register" element={<WithNav crumbs={[HOME, { label: "สมัครสมาชิก" }]} fallback="/login"><Register /></WithNav>} />
        <Route
          path="forgot-password"
          element={<WithNav crumbs={[HOME, { label: "ลืมรหัสผ่าน" }]} fallback="/login"><ForgotPassword /></WithNav>}
        />
        <Route
          path="reset-password"
          element={<WithNav crumbs={[HOME, { label: "ตั้งรหัสผ่านใหม่" }]} fallback="/login"><ResetPassword /></WithNav>}
        />
        {/* แอดมิน: ต้องล็อกอินก่อน (สิทธิ์แอดมินยังตรวจใน AdminHub และต้องถูกบังคับที่ RLS) */}
        <Route
          path="admin"
          element={
            <RequireAuth>
              <WithNav crumbs={[HOME, { label: "แอดมิน" }]}><AdminHub /></WithNav>
            </RequireAuth>
          }
        />
        <Route path="privacy" element={<WithNav crumbs={[HOME, { label: "Privacy Policy" }]}><PrivacyPolicy /></WithNav>} />
        <Route path="terms" element={<WithNav crumbs={[HOME, { label: "Terms of Use" }]}><TermsOfUse /></WithNav>} />
        <Route path="disclaimer" element={<WithNav crumbs={[HOME, { label: "Disclaimer" }]}><Disclaimer /></WithNav>} />
        <Route path="data-sources" element={<WithNav crumbs={[HOME, { label: "Data Sources" }]}><DataSources /></WithNav>} />
        <Route
          path="community-guidelines"
          element={<WithNav crumbs={[HOME, { label: "Community Guidelines" }]}><CommunityGuidelines /></WithNav>}
        />
        {/* ทุก URL ที่ไม่ตรงกับ route ข้างบน */}
        <Route path="*" element={<WithNav crumbs={[HOME, { label: "ไม่พบหน้า" }]}><NotFound /></WithNav>} />
      </Route>
    </Routes>
    </>
  );
}
