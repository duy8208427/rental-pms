import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Dashboard, Property } from "../api/types";
import { Select } from "../components/Select";
import { formatVnd } from "../lib/format";

export function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Property[]>("/api/properties")
      .then((list) => {
        setProperties(list);
        if (list[0]) setPropertyId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (properties.length === 0 && propertyId === "") return;
    setLoading(true);
    setError("");
    const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
    api<Dashboard>(`/api/dashboard${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [propertyId, properties.length]);

  if (error && !data) return <div className="text-[var(--overdue)]">{error}</div>;
  if (loading && !data) return <div className="text-[var(--muted)]">Đang tải…</div>;
  if (!data) return <div className="text-[var(--muted)]">Đang tải…</div>;

  const cards = [
    { label: "Tỷ lệ lấp đầy", value: `${data.occupancy_rate}%`, accent: "#0d7377" },
    { label: "Phòng trống", value: String(data.vacant_units), accent: "#1a9b6c" },
    { label: "Đang thuê", value: String(data.occupied_units), accent: "#3d6b8c" },
    { label: "Trả hôm nay", value: String(data.checkouts_today), accent: "#d97706" },
    { label: "Doanh thu tháng", value: formatVnd(data.revenue_month), accent: "#0d7377" },
    { label: "Chi phí tháng", value: formatVnd(data.expense_month), accent: "#c9784a" },
    {
      label: "HĐ quá hạn",
      value: `${data.overdue_invoices} (${formatVnd(data.overdue_amount)})`,
      accent: "#c23b3b",
    },
    { label: "Hết hạn ≤30 ngày", value: String(data.contracts_expiring_30d), accent: "#c9a227" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Tổng quan</h1>
          <p className="page-sub">
            {data.total_units} unit · {data.reserved_units} đã đặt · {data.maintenance_units} bảo trì
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            className="w-auto min-w-[220px]"
            value={propertyId}
            onChange={setPropertyId}
            options={[
              { value: "", label: "Tất cả tòa" },
              ...properties.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.property_type})`,
              })),
            ]}
          />
          <Link to="/admin/rooms" className="btn-ghost text-sm no-underline">
            Xem sơ đồ phòng →
          </Link>
        </div>
      </div>
      {error && <div className="text-sm text-[var(--overdue)]">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="metric-tile animate-fade-up"
            style={{ ["--tile-accent" as string]: c.accent, animationDelay: `${i * 0.04}s` }}
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{c.label}</div>
            <div className="font-display text-xl font-semibold mt-2.5 text-[var(--text)]">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
