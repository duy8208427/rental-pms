import { Link, Outlet, useLocation } from "react-router-dom";
import { ContactFab } from "./ContactFab";
import { UiChromeProvider, useUiChrome } from "../ui/UiChromeContext";

function PublicLayoutInner() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const { bookingWizardOpen } = useUiChrome();

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className={`sticky top-0 z-30 transition-colors ${
          isHome
            ? "bg-[rgba(8,40,42,0.35)] backdrop-blur-md border-b border-white/10 text-white"
            : "bg-[rgba(255,255,255,0.86)] backdrop-blur-md border-b border-[var(--border)]"
        }`}
      >
        <div className="max-w-[1120px] mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <Link to="/" className="no-underline group">
            <div
              className={`text-[11px] uppercase tracking-[0.22em] ${
                isHome ? "text-white/70" : "text-[var(--muted)]"
              }`}
            >
              Harbor Stay
            </div>
            <div
              className={`font-display text-lg font-semibold leading-tight ${
                isHome ? "text-white" : "text-[var(--primary-deep)]"
              }`}
            >
              Đặt phòng & thuê mặt bằng
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <Link
              to="/?book=1"
              className={`px-3 py-1.5 rounded-full no-underline transition ${
                isHome ? "hover:bg-white/10" : "hover:bg-[var(--primary-soft)] hover:text-[var(--primary-deep)]"
              }`}
            >
              Tìm phòng
            </Link>
            <Link
              to="/lich"
              className={`px-3 py-1.5 rounded-full no-underline transition ${
                isHome ? "hover:bg-white/10" : "hover:bg-[var(--primary-soft)] hover:text-[var(--primary-deep)]"
              }`}
            >
              Lịch phòng
            </Link>
            <Link
              to="/admin/login"
              className={`ml-1 px-3.5 py-1.5 rounded-full no-underline font-medium transition ${
                isHome
                  ? "bg-white/15 hover:bg-white/25"
                  : "bg-[var(--primary)] text-white hover:brightness-110"
              }`}
            >
              Quản trị
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {isHome ? (
          <Outlet />
        ) : (
          <div
            className={`max-w-[1120px] mx-auto px-4 ${
              pathname === "/lich" ? "py-3" : "py-8"
            }`}
          >
            <Outlet />
          </div>
        )}
      </main>

      {pathname === "/lich" ? null : (
        <footer
          className={`py-6 text-center text-xs ${
            isHome ? "bg-[var(--bg-deep)] text-white/55" : "border-t border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          Harbor Stay · Đặt phòng trực tuyến · Liên hệ lễ tân khi nhận phòng
        </footer>
      )}

      <ContactFab hidden={bookingWizardOpen} />
    </div>
  );
}

export function PublicLayout() {
  return (
    <UiChromeProvider>
      <PublicLayoutInner />
    </UiChromeProvider>
  );
}
