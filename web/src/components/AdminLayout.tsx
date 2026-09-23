import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/admin", label: "Tổng quan", end: true },
  { to: "/admin/rooms", label: "Sơ đồ phòng" },
  { to: "/admin/calendar", label: "Lịch cho thuê" },
  { to: "/admin/tenants", label: "Khách thuê" },
  { to: "/admin/managers", label: "Người quản lý" },
  { to: "/admin/contracts", label: "Hợp đồng" },
  { to: "/admin/bookings", label: "Booking" },
  { to: "/admin/finance", label: "Tài chính" },
  { to: "/admin/assets", label: "Tài sản" },
  { to: "/admin/feedback", label: "Góp ý" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="h-dvh flex overflow-hidden bg-[var(--bg)]">
      <aside className="w-60 shrink-0 flex flex-col h-full text-white bg-[linear-gradient(180deg,#0a3d40_0%,#0d7377_55%,#095456_100%)]">
        <div className="px-5 py-6 border-b border-white/10 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/55">Harbor Stay</div>
          <div className="font-display text-xl font-semibold mt-1">Quản trị</div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="shrink-0 p-4 border-t border-white/10 text-sm">
          <div className="font-medium truncate">{user?.full_name}</div>
          <div className="text-white/55 text-xs mt-0.5 capitalize">{user?.role}</div>
          <a href="/" className="mt-3 block text-xs text-white/65 hover:text-white">
            ← Website đặt phòng
          </a>
          <button
            type="button"
            onClick={logout}
            className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent)] hover:brightness-110"
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6 h-full min-h-0 animate-soft-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
