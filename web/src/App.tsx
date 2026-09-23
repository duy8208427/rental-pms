import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { PublicLayout } from "./components/PublicLayout";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AssetsPage } from "./pages/AssetsPage";
import { BookingsPage } from "./pages/BookingsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ContractsPage } from "./pages/ContractsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { FinancePage } from "./pages/FinancePage";
import { LoginPage } from "./pages/LoginPage";
import { ManagersPage } from "./pages/ManagersPage";
import { RoomsPage } from "./pages/RoomsPage";
import { TenantsPage } from "./pages/TenantsPage";
import { HomePage } from "./pages/public/HomePage";
import { PublicCalendarPage } from "./pages/public/PublicCalendarPage";

/** Legacy /dat-phong → home with wizard query */
function DatPhongRedirect() {
  const [params] = useSearchParams();
  const property = params.get("property");
  const to = property ? `/?book=1&property=${encodeURIComponent(property)}` : "/?book=1";
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="lich" element={<PublicCalendarPage />} />
            <Route path="dat-phong" element={<DatPhongRedirect />} />
            <Route path="dat-phong/xac-nhan" element={<Navigate to="/?book=1" replace />} />
          </Route>

          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="rooms" element={<RoomsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="managers" element={<ManagersPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
