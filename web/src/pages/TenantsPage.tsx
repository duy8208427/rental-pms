import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tenant } from "../api/types";
import {
  emailError,
  idNumberError,
  personNameError,
  phoneError,
  sanitizeDigits,
} from "../lib/validation";

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    company: "",
    id_number: "",
  });
  const [error, setError] = useState("");

  function load() {
    api<Tenant[]>("/api/tenants").then(setTenants);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const full_name = form.full_name.trim();
    const phone = sanitizeDigits(form.phone);
    const email = form.email.trim();
    const id_number = sanitizeDigits(form.id_number);
    const err =
      personNameError(full_name) ||
      idNumberError(id_number) ||
      phoneError(phone) ||
      emailError(email);
    if (err) {
      setError(err);
      return;
    }
    try {
      await api("/api/tenants", {
        method: "POST",
        body: JSON.stringify({
          full_name,
          phone,
          email,
          id_number,
          company: form.company.trim() || null,
        }),
      });
      setForm({ full_name: "", phone: "", email: "", company: "", id_number: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Khách thuê</h1>
      <form onSubmit={onSubmit} className="panel p-4 grid md:grid-cols-5 gap-3">
        <input
          className="field"
          placeholder="Họ tên *"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <input
          className="field"
          placeholder="CCCD *"
          inputMode="numeric"
          value={form.id_number}
          onChange={(e) => setForm({ ...form, id_number: sanitizeDigits(e.target.value) })}
          required
        />
        <input
          className="field"
          placeholder="SĐT *"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value) })}
          required
        />
        <input
          className="field"
          type="email"
          placeholder="Email *"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="field"
          placeholder="Công ty"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
        <button type="submit" className="btn-primary md:col-span-5">
          Thêm khách
        </button>
        {error && <div className="md:col-span-5 text-red-600 text-sm">{error}</div>}
      </form>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
            <tr>
              <th className="p-3 font-medium">Họ tên</th>
              <th className="p-3 font-medium">CCCD</th>
              <th className="p-3 font-medium">SĐT</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Công ty</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="p-3 font-medium">{t.full_name}</td>
                <td className="p-3">{t.id_number || "—"}</td>
                <td className="p-3">{t.phone || "—"}</td>
                <td className="p-3">{t.email || "—"}</td>
                <td className="p-3">{t.company || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
