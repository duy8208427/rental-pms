export const STATUS_LABEL: Record<string, string> = {
  vacant: "Trống",
  reserved: "Đã đặt",
  occupied: "Đang thuê",
  checkout_today: "Trả hôm nay",
  maintenance: "Bảo trì",
  overdue: "Quá hạn",
};

export const STATUS_COLOR: Record<string, string> = {
  vacant: "bg-[var(--vacant)]",
  reserved: "bg-[var(--reserved)]",
  occupied: "bg-[var(--occupied)]",
  checkout_today: "bg-[var(--checkout)]",
  maintenance: "bg-[var(--maintenance)]",
  overdue: "bg-[var(--overdue)]",
};

export const STATUS_SOFT: Record<string, string> = {
  vacant: "border-emerald-600/40 bg-emerald-50 text-emerald-900",
  reserved: "border-amber-500/50 bg-amber-50 text-amber-950",
  occupied: "border-sky-700/45 bg-sky-50 text-sky-950",
  checkout_today: "border-orange-500/50 bg-orange-50 text-orange-950",
  maintenance: "border-slate-400 bg-slate-100 text-slate-700",
  overdue: "border-red-500/50 bg-red-50 text-red-900",
};

export function formatVnd(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatDate(s?: string | null): string {
  if (!s) return "—";
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

/** True when due date is past or within `withinDays` (inclusive). Date-only comparison. */
export function isDueSoon(dueDate?: string | null, withinDays = 7): boolean {
  if (!dueDate) return false;
  const iso = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);
  return due.getTime() <= limit.getTime();
}
