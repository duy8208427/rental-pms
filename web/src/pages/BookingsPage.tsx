import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Booking, Property, Tenant, Unit } from "../api/types";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { formatDate, formatVnd } from "../lib/format";
import {
  emailError,
  idNumberError,
  personNameError,
  phoneError,
  sanitizeDigits,
} from "../lib/validation";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    unit_id: "",
    tenant_id: "",
    start_date: todayPlus(0),
    end_date: todayPlus(2),
    guests: "2",
    notes: "",
    new_tenant_name: "",
    new_tenant_phone: "",
    new_tenant_email: "",
    new_tenant_id_number: "",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    api<Booking[]>("/api/bookings").then(setRows);
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
      setForm((f) => ({ ...f, unit_id: u[0]?.id || "" }));
    });
  }, [propertyId]);

  const filteredUnits = useMemo(() => units, [units]);

  function closeCreate() {
    setCreateOpen(false);
    setError("");
    setMsg("");
  }

  async function act(id: string, action: "check-in" | "check-out" | "cancel") {
    await api(`/api/bookings/${id}/${action}`, { method: "POST" });
    load();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      let tenantId = form.tenant_id;
      if (!tenantId) {
        const name = form.new_tenant_name.trim();
        const phone = sanitizeDigits(form.new_tenant_phone);
        const email = form.new_tenant_email.trim();
        const id_number = sanitizeDigits(form.new_tenant_id_number);
        const err =
          personNameError(name) ||
          idNumberError(id_number) ||
          phoneError(phone) ||
          emailError(email);
        if (err) {
          setError(err);
          return;
        }
        const t = await api<Tenant>("/api/tenants", {
          method: "POST",
          body: JSON.stringify({
            full_name: name,
            phone,
            email,
            id_number,
          }),
        });
        tenantId = t.id;
      }
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          unit_id: form.unit_id,
          tenant_id: tenantId,
          start_date: form.start_date,
          end_date: form.end_date,
          guests: Number(form.guests) || 1,
          notes: form.notes || null,
        }),
      });
      setForm((f) => ({
        ...f,
        notes: "",
        new_tenant_name: "",
        new_tenant_phone: "",
        new_tenant_email: "",
        new_tenant_id_number: "",
        tenant_id: tenantId,
      }));
      load();
      closeCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được booking");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Booking ngắn ngày</h1>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          + Tạo booking
        </button>
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        panelClassName="!w-[min(720px,100%)]"
      >
        <form onSubmit={onCreate} className="grid md:grid-cols-3 gap-3">
          <h2 className="md:col-span-3 font-display text-lg font-semibold text-[var(--primary-deep)]">
            Tạo booking (admin)
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
            <span className="text-[var(--muted)]">Phòng / unit</span>
            <Select
              className="mt-1"
              value={form.unit_id}
              onChange={(next) => setForm({ ...form, unit_id: next })}
              required
              options={filteredUnits.map((u) => ({
                value: u.id,
                label: `${u.code} · ${u.name}`,
              }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Khách có sẵn</span>
            <Select
              className="mt-1"
              value={form.tenant_id}
              onChange={(next) => setForm({ ...form, tenant_id: next })}
              placeholder="-Chọn-"
              options={[
                { value: "", label: "-Chọn-" },
                ...tenants.map((t) => ({
                  value: t.id,
                  label: t.phone ? `${t.full_name} (${t.phone})` : t.full_name,
                })),
              ]}
            />
          </label>
          {!form.tenant_id && (
            <>
              <input
                className="field"
                placeholder="Họ tên khách mới *"
                value={form.new_tenant_name}
                onChange={(e) => setForm({ ...form, new_tenant_name: e.target.value })}
                required
              />
              <input
                className="field"
                placeholder="CCCD *"
                inputMode="numeric"
                value={form.new_tenant_id_number}
                onChange={(e) =>
                  setForm({ ...form, new_tenant_id_number: sanitizeDigits(e.target.value) })
                }
                required
              />
              <input
                className="field"
                placeholder="SĐT khách mới *"
                inputMode="numeric"
                value={form.new_tenant_phone}
                onChange={(e) =>
                  setForm({ ...form, new_tenant_phone: sanitizeDigits(e.target.value) })
                }
                required
              />
              <input
                className="field"
                type="email"
                placeholder="Email *"
                value={form.new_tenant_email}
                onChange={(e) => setForm({ ...form, new_tenant_email: e.target.value })}
                required
              />
            </>
          )}
          <label className="text-sm">
            <span className="text-[var(--muted)]">Nhận phòng</span>
            <input
              type="date"
              className="field mt-1"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Trả phòng</span>
            <input
              type="date"
              className="field mt-1"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Số khách</span>
            <input
              type="number"
              min={1}
              className="field mt-1"
              value={form.guests}
              onChange={(e) => setForm({ ...form, guests: e.target.value })}
            />
          </label>
          <input
            className="field md:col-span-3"
            placeholder="Ghi chú"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="md:col-span-3 flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn-primary">
              Tạo booking
            </button>
            <button type="button" className="btn-ghost" onClick={closeCreate}>
              Hủy
            </button>
          </div>
          {error && <div className="md:col-span-3 text-red-600 text-sm">{error}</div>}
          {msg && <div className="md:col-span-3 text-[var(--primary)] text-sm">{msg}</div>}
        </form>
      </Modal>

      <div className="bg-white border border-[var(--border)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-left text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Phòng</th>
              <th className="p-3 font-medium">Khách</th>
              <th className="p-3 font-medium">Ngày</th>
              <th className="p-3 font-medium">Tiền</th>
              <th className="p-3 font-medium">TT</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-[var(--border)]">
                <td className="p-3 font-medium">{b.occupancy?.unit_code}</td>
                <td className="p-3">{b.occupancy?.tenant_name}</td>
                <td className="p-3">
                  {formatDate(b.occupancy?.start_date)} → {formatDate(b.occupancy?.end_date)}
                </td>
                <td className="p-3">{formatVnd(b.total_amount)}</td>
                <td className="p-3">{b.occupancy?.status}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  {(() => {
                    const status = b.occupancy?.status;
                    const terminal = status === "cancelled" || status === "completed";
                    if (terminal) return <span className="text-[var(--muted)]">—</span>;
                    return (
                      <>
                        {status === "reserved" && (
                          <button
                            type="button"
                            className="text-[var(--primary)] hover:underline"
                            onClick={() => act(b.id, "check-in")}
                          >
                            Check-in
                          </button>
                        )}
                        {status === "active" && (
                          <button
                            type="button"
                            className="text-[var(--primary)] hover:underline"
                            onClick={() => act(b.id, "check-out")}
                          >
                            Check-out
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => act(b.id, "cancel")}
                        >
                          Hủy
                        </button>
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
