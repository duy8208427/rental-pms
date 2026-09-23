import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Property, RoomBoardUnit, Unit } from "../api/types";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { STATUS_LABEL, STATUS_SOFT, formatDate, formatVnd } from "../lib/format";

const UNIT_TYPES = [
  { value: "room", label: "Phòng" },
  { value: "suite", label: "Suite" },
  { value: "office", label: "Văn phòng" },
  { value: "workshop", label: "Xưởng" },
];

type UnitForm = {
  code: string;
  unit_type: string;
  floor: string;
  capacity: string;
  price_per_night: string;
  price_per_month: string;
  price_per_hour: string;
  notes: string;
};

const emptyForm = (floor = 1): UnitForm => ({
  code: "",
  unit_type: "room",
  floor: String(floor),
  capacity: "2",
  price_per_night: "",
  price_per_month: "",
  price_per_hour: "",
  notes: "",
});

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function RoomsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [units, setUnits] = useState<RoomBoardUnit[]>([]);
  const [selected, setSelected] = useState<RoomBoardUnit | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitForm>(emptyForm());
  const [formError, setFormError] = useState("");

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId) || null,
    [properties, propertyId],
  );

  function loadProperties() {
    return api<Property[]>("/api/properties").then((p) => {
      setProperties(p);
      return p;
    });
  }

  function loadBoard(pid = propertyId) {
    if (!pid) return Promise.resolve();
    return api<RoomBoardUnit[]>(`/api/room-board?property_id=${pid}`)
      .then(setUnits)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadProperties().then((p) => {
      if (p[0]) setPropertyId(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    setSelected(null);
    setError("");
    loadBoard(propertyId);
  }, [propertyId]);

  const byFloor = useMemo(() => {
    const map = new Map<number, RoomBoardUnit[]>();
    const maxFloor = Math.max(
      property?.floors || 1,
      ...units.map((u) => u.floor),
      1,
    );
    for (let f = 1; f <= maxFloor; f++) map.set(f, []);
    for (const u of units) {
      const list = map.get(u.floor) || [];
      list.push(u);
      map.set(u.floor, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [units, property]);

  function openCreate(floor?: number) {
    setEditingId(null);
    setForm(emptyForm(floor || 1));
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(unitId: string) {
    setFormError("");
    setBusy(true);
    try {
      const u = await api<Unit>(`/api/units/${unitId}`);
      setEditingId(u.id);
      setForm({
        code: u.code,
        unit_type: u.unit_type,
        floor: String(u.floor),
        capacity: String(u.capacity),
        price_per_night: u.price_per_night != null ? String(u.price_per_night) : "",
        price_per_month: u.price_per_month != null ? String(u.price_per_month) : "",
        price_per_hour: u.price_per_hour != null ? String(u.price_per_hour) : "",
        notes: u.notes || "",
      });
      setFormOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được phòng");
    } finally {
      setBusy(false);
    }
  }

  async function ensureFloors(needed: number) {
    if (!property || needed <= property.floors) return property;
    const updated = await api<Property>(`/api/properties/${property.id}`, {
      method: "PATCH",
      body: JSON.stringify({ floors: needed }),
    });
    setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!propertyId) return;
    setFormError("");
    const code = form.code.trim();
    const floor = Math.max(1, Number(form.floor) || 1);
    const capacity = Math.max(1, Number(form.capacity) || 1);
    if (!code) {
      setFormError("Mã phòng là bắt buộc");
      return;
    }
    setBusy(true);
    try {
      await ensureFloors(floor);
      const payload = {
        code,
        name: code,
        unit_type: form.unit_type,
        floor,
        capacity,
        price_per_night: numOrNull(form.price_per_night),
        price_per_month: numOrNull(form.price_per_month),
        price_per_hour: numOrNull(form.price_per_hour),
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api(`/api/units/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg("Đã cập nhật phòng");
      } else {
        await api("/api/units", {
          method: "POST",
          body: JSON.stringify({ ...payload, property_id: propertyId }),
        });
        setMsg("Đã thêm phòng");
      }
      setFormOpen(false);
      await loadBoard();
      if (selected?.id === editingId) setSelected(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Lỗi lưu phòng");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(unitId: string, code: string) {
    if (!window.confirm(`Xóa phòng ${code}? Thao tác không hoàn tác.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/units/${unitId}`, { method: "DELETE" });
      setMsg(`Đã xóa phòng ${code}`);
      if (selected?.id === unitId) setSelected(null);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được phòng");
    } finally {
      setBusy(false);
    }
  }

  async function addFloor() {
    if (!property) return;
    setBusy(true);
    setError("");
    try {
      const next = property.floors + 1;
      const updated = await api<Property>(`/api/properties/${property.id}`, {
        method: "PATCH",
        body: JSON.stringify({ floors: next }),
      });
      setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setMsg(`Đã thêm tầng ${next}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được tầng");
    } finally {
      setBusy(false);
    }
  }

  async function removeFloor(floor: number) {
    if (!property) return;
    if (property.floors <= 1 || floor < 2) {
      setError("Phải giữ ít nhất 1 tầng");
      return;
    }
    const roomsFromFloorUp = units.filter((u) => u.floor >= floor).length;
    if (roomsFromFloorUp > 0) {
      setError(`Còn phòng từ tầng ${floor} trở lên — xóa hết phòng trước`);
      return;
    }
    const confirmMsg =
      floor < property.floors
        ? `Xóa tầng ${floor} và các tầng trống phía trên (còn ${floor - 1} tầng)?`
        : `Xóa tầng ${floor}?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<Property>(`/api/properties/${property.id}`, {
        method: "PATCH",
        body: JSON.stringify({ floors: floor - 1 }),
      });
      setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setMsg(
        floor < property.floors
          ? `Đã xóa từ tầng ${floor} trở lên`
          : `Đã xóa tầng ${floor}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được tầng");
    } finally {
      setBusy(false);
    }
  }

  const floorOptions = useMemo(() => {
    const max = Math.max(property?.floors || 1, Number(form.floor) || 1);
    const next = (property?.floors || 1) + 1;
    const values = new Set<number>();
    for (let i = 1; i <= max; i++) values.add(i);
    values.add(next);
    return [...values]
      .sort((a, b) => a - b)
      .map((f) => ({
        value: String(f),
        label: f > (property?.floors || 1) ? `Tầng ${f} (mới)` : `Tầng ${f}`,
      }));
  }, [property, form.floor]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Sơ đồ phòng</h1>
          <p className="page-sub">Thêm / sửa / xóa phòng, cập nhật giá và tầng</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-auto min-w-[200px]"
            value={propertyId}
            onChange={setPropertyId}
            options={properties.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.property_type})`,
            }))}
          />
          <button type="button" className="btn-secondary" disabled={!property || busy} onClick={addFloor}>
            Thêm tầng
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <span key={k} className={`border px-2 py-1 ${STATUS_SOFT[k]}`}>
            {label}
          </span>
        ))}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {msg && <div className="text-sm text-[var(--vacant)]">{msg}</div>}

      <div className="space-y-6">
        {byFloor.map(([floor, list]) => {
          const roomsFromFloorUp = units.filter((u) => u.floor >= floor).length;
          const canDeleteFloor =
            !!property && property.floors > 1 && floor >= 2 && roomsFromFloorUp === 0;
          return (
          <section key={floor}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
                Tầng {floor}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                  onClick={() => openCreate(floor)}
                >
                  + Phòng tầng {floor}
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--overdue)] hover:underline disabled:opacity-40 disabled:no-underline"
                  disabled={!canDeleteFloor || busy}
                  title={
                    canDeleteFloor
                      ? `Xóa tầng ${floor}`
                      : property && property.floors <= 1
                        ? "Phải giữ ít nhất 1 tầng"
                        : "Xóa hết phòng từ tầng này trở lên trước"
                  }
                  onClick={() => removeFloor(floor)}
                >
                  Xóa tầng
                </button>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] rounded-xl px-4 py-6 text-sm text-[var(--muted)] text-center">
                Chưa có phòng — bấm “+ Phòng tầng {floor}” để thêm
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {list.map((u) => (
                  <div
                    key={u.id}
                    className={`relative text-left border p-3 ${STATUS_SOFT[u.display_status]}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(u)}
                      className="w-full text-left"
                    >
                      <div className="font-semibold pr-10">{u.code}</div>
                      <div className="text-xs mt-1 opacity-80">{STATUS_LABEL[u.display_status]}</div>
                      {u.tenant_name && (
                        <div className="text-xs mt-2 truncate">{u.tenant_name}</div>
                      )}
                    </button>
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-[11px] font-semibold text-[var(--overdue)] hover:underline"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(u.id, u.code);
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-[rgba(8,40,42,0.35)] backdrop-blur-[1px]"
          onClick={() => setSelected(null)}
        >
          <aside
            className="w-full max-w-sm bg-white border-l border-[var(--border)] h-full p-6 space-y-4 overflow-auto shadow-[-12px_0_40px_rgba(9,61,64,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Unit</div>
                <h3 className="text-xl font-semibold">{selected.code}</h3>
                {selected.name && selected.name !== selected.code ? (
                  <p className="text-sm text-[var(--muted)]">{selected.name}</p>
                ) : null}
              </div>
              <button type="button" className="text-sm" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
            <div className={`inline-block border px-2 py-1 text-sm ${STATUS_SOFT[selected.display_status]}`}>
              {STATUS_LABEL[selected.display_status]}
            </div>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Loại</dt>
                <dd>
                  {UNIT_TYPES.find((t) => t.value === selected.unit_type)?.label ||
                    selected.unit_type}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Tầng</dt>
                <dd>{selected.floor}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Sức chứa</dt>
                <dd>{selected.capacity}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Giá / đêm</dt>
                <dd>
                  {selected.price_per_night != null ? formatVnd(selected.price_per_night) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Giá / tháng</dt>
                <dd>
                  {selected.price_per_month != null ? formatVnd(selected.price_per_month) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Giá / giờ</dt>
                <dd>
                  {selected.price_per_hour != null ? formatVnd(selected.price_per_hour) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Ghi chú</dt>
                <dd className="text-right max-w-[60%]">{selected.notes || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Khách</dt>
                <dd>{selected.tenant_name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Loại chiếm chỗ</dt>
                <dd>{selected.occupancy_kind || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Đến hạn / trả</dt>
                <dd>{formatDate(selected.end_date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Công nợ</dt>
                <dd className="font-medium">{formatVnd(selected.balance_due)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => openEdit(selected.id)}
              >
                Sửa
              </button>
              <button
                type="button"
                className="btn-ghost text-[var(--overdue)]"
                disabled={busy}
                onClick={() => onDelete(selected.id, selected.code)}
              >
                Xóa phòng
              </button>
            </div>
          </aside>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} panelClassName="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            {editingId ? "Sửa phòng" : "Thêm phòng"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Mã phòng *</span>
              <input
                className="field mt-1"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Loại</span>
              <Select
                className="mt-1"
                value={form.unit_type}
                onChange={(v) => setForm({ ...form, unit_type: v })}
                options={UNIT_TYPES}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Tầng</span>
              <Select
                className="mt-1"
                value={form.floor}
                onChange={(v) => setForm({ ...form, floor: v })}
                options={floorOptions}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Sức chứa</span>
              <input
                type="number"
                min={1}
                className="field mt-1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Giá / đêm</span>
              <input
                type="number"
                min={0}
                className="field mt-1"
                value={form.price_per_night}
                onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Giá / tháng</span>
              <input
                type="number"
                min={0}
                className="field mt-1"
                value={form.price_per_month}
                onChange={(e) => setForm({ ...form, price_per_month: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Giá / giờ</span>
              <input
                type="number"
                min={0}
                className="field mt-1"
                value={form.price_per_hour}
                onChange={(e) => setForm({ ...form, price_per_hour: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Ghi chú</span>
            <textarea
              className="field mt-1"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {formError ? <div className="text-sm text-red-600">{formError}</div> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {editingId ? "Lưu" : "Thêm"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
