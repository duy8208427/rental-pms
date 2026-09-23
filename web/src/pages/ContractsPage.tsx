import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Contract, Property, Tenant, Unit } from "../api/types";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { formatDate, formatVnd } from "../lib/format";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    unit_id: "",
    tenant_id: "",
    start_date: todayPlus(0),
    end_date: todayPlus(365),
    deposit: "",
    monthly_rent: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    api<Contract[]>("/api/contracts").then(setRows);
    api<Tenant[]>("/api/tenants").then(setTenants);
  }

  useEffect(() => {
    load();
    api<Property[]>("/api/properties").then((p) => {
      setProperties(p);
      if (p[0]) setPropertyId(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    api<Unit[]>(`/api/units?property_id=${propertyId}`).then((u) => {
      setUnits(u);
      setForm((f) => ({
        ...f,
        unit_id: u[0]?.id || "",
        monthly_rent: u[0]?.price_per_month != null ? String(u[0].price_per_month) : f.monthly_rent,
      }));
    });
  }, [propertyId]);

  function closeCreate() {
    setCreateOpen(false);
    setError("");
  }

  async function terminate(id: string) {
    if (!confirm("Thanh lý hợp đồng này?")) return;
    setError("");
    setMsg("");
    try {
      await api(`/api/contracts/${id}/terminate`, { method: "POST" });
      setMsg("Đã thanh lý hợp đồng");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thanh lý được");
    }
  }

  async function renew(id: string) {
    if (!confirm("Gia hạn thêm 12 tháng?")) return;
    setError("");
    setMsg("");
    try {
      await api(`/api/contracts/${id}/renew?months=12`, { method: "POST" });
      setMsg("Đã gia hạn hợp đồng thêm 12 tháng");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gia hạn được");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          unit_id: form.unit_id,
          tenant_id: form.tenant_id,
          start_date: form.start_date,
          end_date: form.end_date,
          deposit: form.deposit ? Number(form.deposit) : 0,
          monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
          notes: form.notes || null,
        }),
      });
      setMsg("Đã tạo hợp đồng");
      load();
      closeCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được hợp đồng");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Hợp đồng thuê</h1>
          {msg && <p className="text-sm text-[var(--primary)] mt-2 font-medium">{msg}</p>}
          {error && !createOpen && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          + Tạo hợp đồng
        </button>
      </div>

      <Modal open={createOpen} onClose={closeCreate} panelClassName="!w-[min(720px,100%)]">
        <form onSubmit={onCreate} className="grid md:grid-cols-3 gap-3">
          <h2 className="md:col-span-3 font-display text-lg font-semibold text-[var(--primary-deep)]">
            Tạo hợp đồng dài hạn
          </h2>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Cơ sở</span>
            <Select
              className="mt-1"
              value={propertyId}
              onChange={setPropertyId}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Unit</span>
            <Select
              className="mt-1"
              value={form.unit_id}
              onChange={(next) => {
                const u = units.find((x) => x.id === next);
                setForm({
                  ...form,
                  unit_id: next,
                  monthly_rent: u?.price_per_month != null ? String(u.price_per_month) : form.monthly_rent,
                });
              }}
              required
              options={units.map((u) => ({ value: u.id, label: `${u.code} · ${u.name}` }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Khách thuê</span>
            <Select
              className="mt-1"
              value={form.tenant_id}
              onChange={(next) => setForm({ ...form, tenant_id: next })}
              required
              placeholder="-Chọn-"
              options={[
                { value: "", label: "-Chọn-" },
                ...tenants.map((t) => ({ value: t.id, label: t.full_name })),
              ]}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Bắt đầu</span>
            <input
              type="date"
              className="field mt-1"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Kết thúc</span>
            <input
              type="date"
              className="field mt-1"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Thuê / tháng</span>
            <input
              type="number"
              className="field mt-1"
              value={form.monthly_rent}
              onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Đặt cọc</span>
            <input
              type="number"
              className="field mt-1"
              value={form.deposit}
              onChange={(e) => setForm({ ...form, deposit: e.target.value })}
            />
          </label>
          <input
            className="field md:col-span-2"
            placeholder="Ghi chú"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="md:col-span-3 flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn-primary">
              Tạo hợp đồng
            </button>
            <button type="button" className="btn-ghost" onClick={closeCreate}>
              Hủy
            </button>
          </div>
          {error && <div className="md:col-span-3 text-red-600 text-sm">{error}</div>}
        </form>
      </Modal>

      <div className="bg-white border border-[var(--border)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-left text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Số HĐ</th>
              <th className="p-3 font-medium">Unit</th>
              <th className="p-3 font-medium">Khách</th>
              <th className="p-3 font-medium">Thuê/tháng</th>
              <th className="p-3 font-medium">Thời hạn</th>
              <th className="p-3 font-medium">TT</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="p-3 font-medium">{c.contract_no}</td>
                <td className="p-3">{c.occupancy?.unit_code || "—"}</td>
                <td className="p-3">{c.occupancy?.tenant_name || "—"}</td>
                <td className="p-3">{formatVnd(c.monthly_rent)}</td>
                <td className="p-3">
                  {formatDate(c.occupancy?.start_date)} → {formatDate(c.occupancy?.end_date)}
                </td>
                <td className="p-3">{c.occupancy?.status}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-[var(--primary)] cursor-pointer font-medium hover:underline"
                    onClick={() => renew(c.id)}
                  >
                    Gia hạn
                  </button>
                  <button
                    type="button"
                    className="text-red-600 cursor-pointer font-medium hover:underline"
                    onClick={() => terminate(c.id)}
                  >
                    Thanh lý
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
