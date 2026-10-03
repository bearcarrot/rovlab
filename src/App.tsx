import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { PageNav, type Crumb } from "@/components/layout/PageNav";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { Home } from "@/pages/Home";
import { Heroes } from "@/pages/Heroes";
import { HeroDetail } from "@/pages/HeroDetail";
import { TierList } from "@/pages/TierList";
import { CounterPick } from "@/pages/CounterPick";
import { DraftAssistant } from "@/pages/DraftAssistant";
import { Matchup } from "@/pages/Matchup";
import { Favorites } from "@/pages/Favorites";
import { Profile } from "@/pages/Profile";
import { PlayerProfile } from "@/pages/PlayerProfile";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { Stats } from "@/pages/Stats";
import { Learn } from "@/pages/Learn";
import { GuideDetail } from "@/pages/GuideDetail";
import { AdminHub } from "@/pages/AdminHub";
import { PrivacyPolicy, TermsOfUse, Disclaimer, DataSources, CommunityGuidelines } from "@/pages/Legal";

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
          path="profile"
          element={
            <RequireAuth>
              <WithNav crumbs={[HOME, { label: "โปรไฟล์" }]}><Profile /></WithNav>
            </RequireAuth>
          }
        />
        <Route path="players/:id" element={<WithNav crumbs={[HOME, { label: "โปรไฟล์ผู้เล่น" }]}><PlayerProfile /></WithNav>} />
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
        <Route path="admin" element={<WithNav crumbs={[HOME, { label: "แอดมิน" }]}><AdminHub /></WithNav>} />
        <Route path="privacy" element={<WithNav crumbs={[HOME, { label: "Privacy Policy" }]}><PrivacyPolicy /></WithNav>} />
        <Route path="terms" element={<WithNav crumbs={[HOME, { label: "Terms of Use" }]}><TermsOfUse /></WithNav>} />
        <Route path="disclaimer" element={<WithNav crumbs={[HOME, { label: "Disclaimer" }]}><Disclaimer /></WithNav>} />
        <Route path="data-sources" element={<WithNav crumbs={[HOME, { label: "Data Sources" }]}><DataSources /></WithNav>} />
        <Route
          path="community-guidelines"
          element={<WithNav crumbs={[HOME, { label: "Community Guidelines" }]}><CommunityGuidelines /></WithNav>}
        />
      </Route>
    </Routes>
  );
}
