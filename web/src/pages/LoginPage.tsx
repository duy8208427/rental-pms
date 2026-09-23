import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, loading, login, logout } = useAuth();
  const location = useLocation();
  const deniedRole = (location.state as { deniedRole?: string } | null)?.deniedRole;
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState(
    deniedRole === "manager"
      ? "Tài khoản Người quản lý chỉ dùng trên app mobile, không vào được web quản trị."
      : "",
  );
  const [busy, setBusy] = useState(false);

  if (!loading && user?.role === "admin") return <Navigate to="/admin" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  // Non-admin session on login page: clear so they can switch accounts
  if (!loading && user && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel max-w-md w-full p-8 space-y-4">
          <h1 className="page-title">Không đủ quyền web</h1>
          <p className="page-sub">
            {user.role === "manager"
              ? "Người quản lý chỉ vận hành trên app mobile (phòng hôm nay, thu tiền theo căn được giao)."
              : "Tài khoản này không dùng được web quản trị."}
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => logout()}>
            Đăng xuất
          </button>
          <Link to="/" className="block text-center text-sm text-[var(--muted)]">
            ← Về trang đặt phòng
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden bg-[var(--bg-deep)]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-[rgba(10,61,64,0.65)] to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-10 text-white">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/65">Harbor Stay</p>
          <h1 className="font-display text-4xl font-semibold mt-3 leading-tight max-w-md">
            Bảng điều khiển vận hành cho thuê
          </h1>
          <p className="mt-3 text-white/70 max-w-sm">
            Quản lý phòng, hợp đồng, booking và tài chính trên một giao diện thống nhất.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={onSubmit} className="panel w-full max-w-md p-8 space-y-5 animate-fade-up">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Harbor Stay</div>
            <h1 className="page-title mt-1">Đăng nhập quản trị</h1>
            <p className="page-sub">Demo: admin@example.com / admin123</p>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Email</span>
            <input
              className="field mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Mật khẩu</span>
            <input
              className="field mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {error && <div className="text-sm text-[var(--overdue)]">{error}</div>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <Link to="/" className="block text-center text-sm text-[var(--muted)] hover:text-[var(--primary)]">
            ← Về trang đặt phòng
          </Link>
        </form>
      </div>
    </div>
  );
}
