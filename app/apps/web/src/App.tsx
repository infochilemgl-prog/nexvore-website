import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/auth";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import InboxPage from "@/pages/InboxPage";
import ReservationsPage from "@/pages/ReservationsPage";
import GuestsPage from "@/pages/GuestsPage";
import ConciergePage from "@/pages/ConciergePage";
import MaintenancePage from "@/pages/MaintenancePage";
import HousekeepingPage from "@/pages/HousekeepingPage";
import KnowledgePage from "@/pages/KnowledgePage";
import CompetitorsPage from "@/pages/CompetitorsPage";
import MarketingPage from "@/pages/MarketingPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import SettingsPage from "@/pages/SettingsPage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/concierge" element={<ConciergePage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/housekeeping" element={<HousekeepingPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/competitors" element={<CompetitorsPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
