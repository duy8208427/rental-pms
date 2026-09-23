import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Property, User } from "../api/types";
import { Modal } from "../components/Modal";
import {
  emailError,
  idNumberError,
  personNameError,
  phoneError,
  sanitizeDigits,
} from "../lib/validation";

type ManagerForm = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  id_number: string;
  managed_property_id: string;
};

const emptyForm: ManagerForm = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  id_number: "",
  managed_property_id: "",
};

export function ManagersPage() {
  const [managers, setManagers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<ManagerForm>(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    full_name: "",
    phone: "",
    id_number: "",
    managed_property_id: "",
    password: "",
  });
  const [error, setError] = useState("");

  function load() {
    api<User[]>("/api/managers").then(setManagers);
    api<Property[]>("/api/properties").then(setProperties);
  }

  useEffect(() => {
    load();
  }, []);

  function closeCreate() {
    setCreateOpen(false);
    setForm(emptyForm);
    setError("");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const full_name = form.full_name.trim();
    const email = form.email.trim();
    const phone = sanitizeDigits(form.phone);
    const id_number = sanitizeDigits(form.id_number);
    const err =
      personNameError(full_name) ||
      idNumberError(id_number) ||
      emailError(email) ||
      phoneError(phone, false);
    if (err) {
      setError(err);
      return;
    }
    if (!form.managed_property_id) {
      setError("Chọn cơ sở phụ trách");
      return;
    }
    try {
      await api("/api/managers", {
        method: "POST",
        body: JSON.stringify({
          full_name,
          email,
          password: form.password,
          phone: phone || null,
          id_number,
          managed_property_id: form.managed_property_id,
        }),
      });
      closeCreate();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  function startEdit(m: User) {
    setEditingId(m.id);
    setEdit({
      full_name: m.full_name,
      phone: m.phone || "",
      id_number: m.id_number || "",
      managed_property_id: m.managed_property_id || "",
      password: "",
    });
    setError("");
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError("");
    const full_name = edit.full_name.trim();
    const phone = sanitizeDigits(edit.phone);
    const id_number = sanitizeDigits(edit.id_number);
    const err =
      personNameError(full_name) ||
      idNumberError(id_number) ||
      phoneError(phone, false);
    if (err) {
      setError(err);
      return;
    }
    try {
      const body: Record<string, unknown> = {
        full_name,
        phone: phone || null,
        id_number,
        managed_property_id: edit.managed_property_id,
      };
      if (edit.password.trim()) body.password = edit.password.trim();
      await api(`/api/managers/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function setActive(id: string, is_active: boolean) {
    setError("");
    try {
      if (!is_active) {
        await api(`/api/managers/${id}`, { method: "DELETE" });
      } else {
        await api(`/api/managers/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: true }),
        });
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Người quản lý</h1>
          <p className="page-sub">
            Tạo tài khoản mobile cho từng cơ sở — mỗi người phụ trách một căn.
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
          Thêm người quản lý
        </button>
      </div>

      {error && !createOpen && <div className="text-red-600 text-sm">{error}</div>}

      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Họ tên</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">CCCD</th>
              <th className="p-3 font-medium">SĐT</th>
              <th className="p-3 font-medium">Cơ sở</th>
              <th className="p-3 font-medium">Trạng thái</th>
              <th className="p-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.id} className="border-t border-[var(--border)] align-top">
                {editingId === m.id ? (
                  <td colSpan={7} className="p-3">
                    <form onSubmit={onSaveEdit} className="space-y-3">
                      <div className="grid md:grid-cols-6 gap-2">
                        <input
                          className="field"
                          placeholder="Họ tên *"
                          value={edit.full_name}
                          onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                          required
                        />
                        <div className="field bg-[var(--surface-soft)] text-[var(--muted)] flex items-center">
                          {m.email}
                        </div>
                        <input
                          className="field"
                          placeholder="CCCD *"
                          inputMode="numeric"
                          value={edit.id_number}
                          onChange={(e) =>
                            setEdit({ ...edit, id_number: sanitizeDigits(e.target.value) })
                          }
                          required
                        />
                        <input
                          className="field"
                          placeholder="SĐT"
                          inputMode="numeric"
                          value={edit.phone}
                          onChange={(e) =>
                            setEdit({ ...edit, phone: sanitizeDigits(e.target.value) })
                          }
                        />
                        <select
                          className="field"
                          value={edit.managed_property_id}
                          onChange={(e) =>
                            setEdit({ ...edit, managed_property_id: e.target.value })
                          }
                          required
                        >
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="field"
                          type="password"
                          placeholder="Mật khẩu mới (tuỳ chọn)"
                          value={edit.password}
                          onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                          minLength={6}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="btn-primary">
                          Lưu
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Huỷ
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="p-3 font-medium">{m.full_name}</td>
                    <td className="p-3">{m.email}</td>
                    <td className="p-3">{m.id_number || "—"}</td>
                    <td className="p-3">{m.phone || "—"}</td>
                    <td className="p-3">{m.managed_property_name || "—"}</td>
                    <td className="p-3">
                      {m.is_active === false ? (
                        <span className="text-[var(--overdue)]">Tắt</span>
                      ) : (
                        <span className="text-[var(--occupied)]">Hoạt động</span>
                      )}
                    </td>
                    <td className="p-3 space-x-2 whitespace-nowrap">
                      <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(m)}>
                        Sửa
                      </button>
                      {m.is_active === false ? (
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => setActive(m.id, true)}
                        >
                          Kích hoạt
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-[var(--overdue)]"
                          onClick={() => setActive(m.id, false)}
                        >
                          Vô hiệu hóa
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {managers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[var(--muted)]">
                  Chưa có người quản lý
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={closeCreate} panelClassName="!w-[min(640px,100%)]">
        <h3 className="font-display text-lg font-semibold text-[var(--primary-deep)]">
          Thêm người quản lý
        </h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          Tài khoản chỉ dùng trên app mobile, phụ trách một cơ sở.
        </p>
        <form onSubmit={onCreate} className="mt-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Họ tên *</span>
            <input
              className="field mt-1"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">CCCD *</span>
            <input
              className="field mt-1"
              inputMode="numeric"
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: sanitizeDigits(e.target.value) })}
              required
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Email *</span>
            <input
              className="field mt-1"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">SĐT</span>
            <input
              className="field mt-1"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value) })}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Mật khẩu *</span>
            <input
              className="field mt-1"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--muted)]">Cơ sở phụ trách *</span>
            <select
              className="field mt-1"
              value={form.managed_property_id}
              onChange={(e) => setForm({ ...form, managed_property_id: e.target.value })}
              required
            >
              <option value="">Chọn cơ sở</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="sm:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" className="btn-ghost" onClick={closeCreate}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary">
              Tạo tài khoản
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
