import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") {
    return <Navigate to="/admin/login" replace state={{ deniedRole: user.role }} />;
  }
  return <Outlet />;
}
