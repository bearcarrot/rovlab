import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { Home } from "@/pages/Home";
import { Heroes } from "@/pages/Heroes";
import { HeroDetail } from "@/pages/HeroDetail";
import { TierList } from "@/pages/TierList";
import { CounterPick } from "@/pages/CounterPick";
import { DraftAssistant } from "@/pages/DraftAssistant";
import { ItemBuild } from "@/pages/ItemBuild";
import { Matchup } from "@/pages/Matchup";
import { Favorites } from "@/pages/Favorites";
import { Profile } from "@/pages/Profile";
import { PlayerProfile } from "@/pages/PlayerProfile";
import { Login } from "@/pages/Login";
import { Stats } from "@/pages/Stats";
import { Learn } from "@/pages/Learn";
import { GuideDetail } from "@/pages/GuideDetail";
import { Admin } from "@/pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="heroes" element={<Heroes />} />
        <Route path="heroes/:slug" element={<HeroDetail />} />
        <Route path="tier-list" element={<TierList />} />
        <Route path="counter-pick" element={<CounterPick />} />
        <Route path="matchup" element={<Matchup />} />
        <Route path="draft" element={<DraftAssistant />} />
        <Route path="build" element={<ItemBuild />} />
        <Route path="stats" element={<Stats />} />
        <Route path="learn" element={<Learn />} />
        <Route path="learn/:slug" element={<GuideDetail />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="profile" element={<Profile />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="login" element={<Login />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
