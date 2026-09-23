import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Asset, Unit } from "../api/types";
import { DateField } from "../components/DateField";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { formatDate, formatVnd } from "../lib/format";

const CONDITIONS = [
  { value: "good", label: "Tốt" },
  { value: "fair", label: "Khá" },
  { value: "damaged", label: "Hỏng" },
  { value: "missing", label: "Thiếu" },
];

const CONDITION_LABEL: Record<string, string> = {
  good: "Tốt",
  fair: "Khá",
  damaged: "Hỏng",
  missing: "Thiếu",
};

const FILTER_FIELDS = [
  { value: "q", label: "Tìm kiếm", kind: "text" as const },
  { value: "unit_id", label: "Unit", kind: "unit" as const },
  { value: "condition", label: "Tình trạng", kind: "condition" as const },
  { value: "supplier", label: "Nhà cung cấp", kind: "text" as const },
  { value: "category", label: "Loại", kind: "text" as const },
  { value: "purchased_at", label: "Ngày mua", kind: "date" as const },
  { value: "last_repaired_at", label: "Sửa gần nhất", kind: "date" as const },
  { value: "amount", label: "Số tiền", kind: "sort" as const },
];

type CreateForm = {
  unit_id: string;
  name: string;
  category: string;
  quantity: string;
  condition: string;
  supplier: string;
  purchased_at: string;
  last_repaired_at: string;
  purchase_value: string;
};

const emptyCreate: CreateForm = {
  unit_id: "",
  name: "",
  category: "",
  quantity: "1",
  condition: "good",
  supplier: "",
  purchased_at: "",
  last_repaired_at: "",
  purchase_value: "",
};

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filterField, setFilterField] = useState("q");
  const [filterValue, setFilterValue] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const fieldMeta = FILTER_FIELDS.find((f) => f.value === filterField) || FILTER_FIELDS[0];

  const displayAssets = useMemo(() => {
    if (filterField !== "amount") return assets;
    const sorted = [...assets].sort((a, b) => Number(a.purchase_value || 0) - Number(b.purchase_value || 0));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [assets, filterField, sortDir]);

  async function fetchAssets(params: URLSearchParams) {
    const qs = params.toString();
    const rows = await api<Asset[]>(`/api/assets${qs ? `?${qs}` : ""}`);
    setAssets(rows);
  }

  useEffect(() => {
    api<Unit[]>("/api/units").then((u) => {
      setUnits(u);
      if (u[0]) setForm((f) => ({ ...f, unit_id: f.unit_id || u[0].id }));
    });
    fetchAssets(new URLSearchParams()).catch((e) => setError(e.message));
  }, []);

  function onSearch(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    const p = new URLSearchParams();
    if (fieldMeta.kind === "sort") {
      fetchAssets(p).catch((err) => setError(err.message));
      return;
    }
    if (!filterValue) {
      fetchAssets(p).catch((err) => setError(err.message));
      return;
    }
    if (filterField === "q") p.set("q", filterValue);
    else if (filterField === "unit_id") p.set("unit_id", filterValue);
    else if (filterField === "condition") p.set("condition", filterValue);
    else if (filterField === "supplier") p.set("supplier", filterValue);
    else if (filterField === "category") p.set("category", filterValue);
    else if (filterField === "purchased_at") {
      p.set("purchased_from", filterValue);
      p.set("purchased_to", filterValue);
    } else if (filterField === "last_repaired_at") {
      p.set("repaired_from", filterValue);
      p.set("repaired_to", filterValue);
    }
    fetchAssets(p).catch((err) => setError(err.message));
  }

  function clearFilter() {
    setFilterField("q");
    setFilterValue("");
    setSortDir("desc");
    setError("");
    fetchAssets(new URLSearchParams()).catch((e) => setError(e.message));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          unit_id: form.unit_id,
          name: form.name,
          category: form.category || null,
          quantity: Number(form.quantity) || 1,
          condition: form.condition,
          supplier: form.supplier || null,
          purchased_at: form.purchased_at || null,
          last_repaired_at: form.last_repaired_at || null,
          purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
        }),
      });
      setMsg("Đã thêm tài sản");
      setForm({ ...emptyCreate, unit_id: form.unit_id || units[0]?.id || "" });
      setCreateOpen(false);
      onSearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Tài sản cho thuê</h1>
          <p className="page-sub">Theo dõi NCC, ngày mua, sửa chữa và giá trị — lọc theo nhu cầu vận hành</p>
        </div>
        <button type="button" className="btn-primary !py-2 !px-4 text-sm" onClick={() => setCreateOpen(true)}>
          + Thêm tài sản
        </button>
      </div>

      <form onSubmit={onSearch} className="panel p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <span className="text-sm text-[var(--muted)]">Giá trị</span>
          {fieldMeta.kind === "text" ? (
            <input
              className="field mt-1"
              placeholder="Nhập thông tin…"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          ) : null}
          {fieldMeta.kind === "unit" ? (
            <Select
              className="mt-1"
              value={filterValue}
              onChange={setFilterValue}
              placeholder="Chọn unit"
              options={[
                { value: "", label: "Tất cả unit" },
                ...units.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` })),
              ]}
            />
          ) : null}
          {fieldMeta.kind === "condition" ? (
            <Select
              className="mt-1"
              value={filterValue}
              onChange={setFilterValue}
              options={[{ value: "", label: "Tất cả" }, ...CONDITIONS]}
            />
          ) : null}
          {fieldMeta.kind === "date" ? (
            <DateField className="mt-1" value={filterValue} onChange={setFilterValue} />
          ) : null}
          {fieldMeta.kind === "sort" ? (
            <Select
              className="mt-1"
              value={sortDir}
              onChange={(v) => setSortDir(v as "asc" | "desc")}
              options={[
                { value: "asc", label: "Tăng dần" },
                { value: "desc", label: "Giảm dần" },
              ]}
            />
          ) : null}
        </div>
        <div className="min-w-[180px]">
          <span className="text-sm text-[var(--muted)]">Trường lọc</span>
          <Select
            className="mt-1"
            value={filterField}
            onChange={(v) => {
              setFilterField(v);
              setFilterValue("");
            }}
            options={FILTER_FIELDS.map((f) => ({ value: f.value, label: f.label }))}
          />
        </div>
        <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
          Tìm kiếm
        </button>
        <button type="button" className="btn-ghost !py-2 !px-4 text-sm" onClick={clearFilter}>
          Xóa lọc
        </button>
        <span className="text-sm text-[var(--muted)] self-center">{displayAssets.length} kết quả</span>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-[var(--primary)]">{msg}</p> : null}

      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Tên</th>
              <th className="p-3 font-medium">Unit</th>
              <th className="p-3 font-medium">Loại</th>
              <th className="p-3 font-medium">SL</th>
              <th className="p-3 font-medium">Tình trạng</th>
              <th className="p-3 font-medium">NCC</th>
              <th className="p-3 font-medium">Ngày mua</th>
              <th className="p-3 font-medium">Sửa gần nhất</th>
              <th className="p-3 font-medium">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {displayAssets.map((a) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="p-3 font-medium">{a.name}</td>
                <td className="p-3">{a.unit_code || a.unit_id.slice(0, 8)}</td>
                <td className="p-3">{a.category || "—"}</td>
                <td className="p-3">{a.quantity}</td>
                <td className="p-3">{CONDITION_LABEL[a.condition] || a.condition}</td>
                <td className="p-3">{a.supplier || "—"}</td>
                <td className="p-3">{formatDate(a.purchased_at)}</td>
                <td className="p-3">{formatDate(a.last_repaired_at)}</td>
                <td className="p-3">{a.purchase_value != null ? formatVnd(a.purchase_value) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} panelClassName="!w-[min(720px,100%)]">
        <h3 className="font-display text-lg font-semibold text-[var(--primary-deep)]">Thêm tài sản</h3>
        <form onSubmit={onCreate} className="mt-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Unit *</span>
            <Select
              className="mt-1"
              required
              value={form.unit_id}
              onChange={(next) => setForm({ ...form, unit_id: next })}
              options={units.map((u) => ({ value: u.id, label: u.code }))}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Tên *</span>
            <input
              className="field mt-1"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Loại</span>
            <input
              className="field mt-1"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Số lượng</span>
            <input
              type="number"
              min={1}
              className="field mt-1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Tình trạng</span>
            <Select
              className="mt-1"
              value={form.condition}
              onChange={(next) => setForm({ ...form, condition: next })}
              options={CONDITIONS}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Nhà cung cấp</span>
            <input
              className="field mt-1"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Ngày mua</span>
            <DateField
              className="mt-1"
              value={form.purchased_at}
              onChange={(v) => setForm({ ...form, purchased_at: v })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Sửa gần nhất</span>
            <DateField
              className="mt-1"
              value={form.last_repaired_at}
              onChange={(v) => setForm({ ...form, last_repaired_at: v })}
            />
          </label>
          <label className="text-sm block sm:col-span-2">
            <span className="text-[var(--muted)]">Số tiền</span>
            <input
              type="number"
              min={0}
              className="field mt-1"
              value={form.purchase_value}
              onChange={(e) => setForm({ ...form, purchase_value: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu tài sản"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
