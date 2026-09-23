import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Expense, ExpenseJournal, ExpenseMonthStatus, Invoice, Payment, Property } from "../api/types";
import { DateField } from "../components/DateField";
import { DateTimeField } from "../components/DateTimeField";
import { Modal } from "../components/Modal";
import { Select } from "../components/Select";
import { formatDate, formatDateTime, formatVnd, isDueSoon } from "../lib/format";

const API_BASE = import.meta.env.VITE_API_URL || "";

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EXPENSE_CATEGORIES = ["Điện nước", "Bảo trì", "Vệ sinh", "Nhân sự", "Khác"];

const DUE_CYCLE_OPTIONS = [
  { value: "monthly", label: "Tháng" },
  { value: "quarterly", label: "Quý" },
  { value: "yearly", label: "Năm" },
] as const;

function dueCycleLabel(cycle?: string | null): string {
  return DUE_CYCLE_OPTIONS.find((o) => o.value === cycle)?.label || "—";
}

function expenseStatusLabel(status?: string | null): string {
  if (status === "paid") return "Đã đóng";
  if (status === "collecting") return "Thu tiền";
  return "Chưa đóng";
}

function dueAlertClass(iso?: string | null): string {
  return isDueSoon(iso, 60) ? "text-[var(--overdue)] font-medium" : "";
}

export function FinancePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [expenseMonth, setExpenseMonth] = useState<ExpenseMonthStatus | null>(null);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);
  const [draftPaidAt, setDraftPaidAt] = useState<Record<string, string>>({});
  const [expenseCreateOpen, setExpenseCreateOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    property_id: "",
    category: "Điện nước",
    amount: "",
    expense_date: todayIso(),
    description: "",
    due_cycle: "monthly" as "monthly" | "quarterly" | "yearly",
    recurring: true,
    due_date: todayIso(),
  });
  const [expenseFormError, setExpenseFormError] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalExpense, setJournalExpense] = useState<Expense | null>(null);
  const [journals, setJournals] = useState<ExpenseJournal[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) map.set(p.id, p.name);
    return map;
  }, [properties]);

  function load() {
    const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
    api<Invoice[]>(`/api/invoices${qs}`).then(setInvoices);
    api<Expense[]>(`/api/expenses${qs}`).then(setExpenses);
    const [y, m] = currentMonthValue().split("-").map(Number);
    api<ExpenseMonthStatus>(`/api/expenses/month-status?year=${y}&month=${m}`).then(setExpenseMonth);
  }

  /** datetime-local value → ISO for API */
  function draftToIso(localValue: string): string {
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return localValue;
    return d.toISOString();
  }

  useEffect(() => {
    api<Property[]>("/api/properties").then((list) => {
      setProperties(list);
      if (list[0]) {
        setExpenseForm((f) => ({ ...f, property_id: f.property_id || list[0].id }));
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [propertyId]);

  function openExpenseCreate() {
    setExpenseFormError("");
    setExpenseForm({
      property_id: propertyId || properties[0]?.id || "",
      category: "Điện nước",
      amount: "",
      expense_date: todayIso(),
      description: "",
      due_cycle: "monthly",
      recurring: true,
      due_date: todayIso(),
    });
    setExpenseCreateOpen(true);
  }

  async function createExpense(e: FormEvent) {
    e.preventDefault();
    setExpenseFormError("");
    const amount = Number(expenseForm.amount);
    if (!expenseForm.property_id) {
      setExpenseFormError("Chọn tòa");
      return;
    }
    if (!expenseForm.category.trim()) {
      setExpenseFormError("Nhập danh mục");
      return;
    }
    if (!amount || amount <= 0) {
      setExpenseFormError("Số tiền phải lớn hơn 0");
      return;
    }
    if (!expenseForm.expense_date) {
      setExpenseFormError("Chọn ngày");
      return;
    }
    if (!expenseForm.due_date) {
      setExpenseFormError("Chọn hạn đóng");
      return;
    }
    try {
      await api("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          property_id: expenseForm.property_id,
          category: expenseForm.category.trim(),
          amount,
          expense_date: expenseForm.expense_date,
          description: expenseForm.description.trim() || null,
          status: "unpaid",
          due_cycle: expenseForm.due_cycle,
          recurring: expenseForm.recurring,
          due_date: expenseForm.due_date,
        }),
      });
      setExpenseCreateOpen(false);
      setToast({ title: "Đã thêm", detail: "Khoản chi phí mới đã được tạo" });
      load();
    } catch (err) {
      setExpenseFormError(err instanceof Error ? err.message : "Không tạo được chi phí");
    }
  }

  async function openJournal(ex: Expense) {
    setJournalExpense(ex);
    setJournalOpen(true);
    setJournalLoading(true);
    setJournals([]);
    try {
      const rows = await api<ExpenseJournal[]>(`/api/expenses/${ex.id}/journals`);
      setJournals(rows);
    } catch (err) {
      setToast({
        title: "Không tải sổ nhật ký",
        detail: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    } finally {
      setJournalLoading(false);
    }
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function pay(invoiceId: string, e: FormEvent) {
    e.preventDefault();
    const amount = Number(payAmount[invoiceId] || 0);
    if (!amount) return;
    const inv = invoices.find((i) => i.id === invoiceId);
    try {
      await api("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoice_id: invoiceId, amount, method: "cash" }),
      });
      setPayAmount((p) => ({ ...p, [invoiceId]: "" }));
      setToast({
        title: "Đã thu",
        detail: `${formatVnd(amount)} · ${inv?.tenant_name || "Khách"} · ${inv?.property_name || ""} · ${inv?.invoice_no || ""}`,
      });
      load();
    } catch (err) {
      setToast({
        title: "Lỗi thu tiền",
        detail: err instanceof Error ? err.message : "Không thu được",
      });
    }
  }

  async function openMonthReport() {
    setMonthOpen(true);
    const [y, m] = monthValue.split("-").map(Number);
    const rows = await api<Payment[]>(`/api/payments?year=${y}&month=${m}`);
    setMonthPayments(rows);
  }

  useEffect(() => {
    if (!monthOpen) return;
    const [y, m] = monthValue.split("-").map(Number);
    api<Payment[]>(`/api/payments?year=${y}&month=${m}`).then(setMonthPayments);
  }, [monthValue, monthOpen]);

  const monthTotal = useMemo(
    () => monthPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [monthPayments],
  );

  async function markExpensePaid(id: string) {
    const draft = draftPaidAt[id];
    const ex = expenses.find((e) => e.id === id);
    if (!draft || !ex?.image_url) {
      setToast({
        title: "Thiếu thông tin",
        detail: "Chọn thời gian đóng và upload hình ảnh trước khi đánh dấu đã đóng",
      });
      return;
    }
    try {
      await api(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", paid_at: draftToIso(draft) }),
      });
      setDraftPaidAt((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setToast({ title: "Đã đóng", detail: "Chi phí đã đánh dấu đã đóng tiền" });
      load();
    } catch (err) {
      setToast({
        title: "Không đánh dấu được",
        detail: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    }
  }

  async function uploadExpenseImage(id: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("rental_token");
    const res = await fetch(`${API_BASE}/api/expenses/${id}/image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToast({ title: "Lỗi upload", detail: data.detail || res.statusText });
      return;
    }
    load();
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Tài chính</h1>
          <p className="page-sub">Hóa đơn, thanh toán và chi phí theo từng tòa</p>
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
          <button type="button" className="btn-ghost" onClick={openMonthReport}>
            Thu theo tháng
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-[var(--primary-deep)]">Hóa đơn / công nợ</h2>
        <div className="panel overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">Số HĐ</th>
                <th className="p-3 font-medium">Tòa</th>
                <th className="p-3 font-medium">Phòng</th>
                <th className="p-3 font-medium">Khách</th>
                <th className="p-3 font-medium">Số tiền</th>
                <th className="p-3 font-medium">Còn nợ</th>
                <th className="p-3 font-medium">Hạn</th>
                <th className="p-3 font-medium">TT</th>
                <th className="p-3 font-medium">Thu tiền</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const unpaid = inv.status !== "paid" && inv.status !== "cancelled";
                const dueAlert = unpaid && isDueSoon(inv.due_date, 7);
                return (
                <tr key={inv.id} className="border-t border-[var(--border)]">
                  <td className="p-3 font-medium">{inv.invoice_no}</td>
                  <td className="p-3">{inv.property_name || "—"}</td>
                  <td className="p-3">{inv.unit_code || "—"}</td>
                  <td className="p-3">{inv.tenant_name}</td>
                  <td className="p-3">{formatVnd(inv.amount)}</td>
                  <td className="p-3">{formatVnd(inv.balance ?? inv.amount - inv.paid_amount)}</td>
                  <td
                    className={`p-3 ${
                      dueAlert ? "font-semibold text-[var(--overdue)]" : ""
                    }`}
                    title={dueAlert ? "Sắp đến hạn hoặc đã quá hạn" : undefined}
                  >
                    {formatDate(inv.due_date)}
                  </td>
                  <td className="p-3">{inv.status}</td>
                  <td className="p-3">
                    {unpaid && (
                      <form className="flex gap-1" onSubmit={(e) => pay(inv.id, e)}>
                        <input
                          className="field !py-1 !px-2 w-28"
                          placeholder="Số tiền"
                          value={payAmount[inv.id] || ""}
                          onChange={(e) => setPayAmount({ ...payAmount, [inv.id]: e.target.value })}
                        />
                        <button type="submit" className="btn-primary !rounded-lg !px-3 !py-1.5 text-xs">
                          Thu
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[var(--primary-deep)]">Chi phí</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary !py-2 !px-4 text-sm" onClick={openExpenseCreate}>
              + Thêm chi phí
            </button>
            <button
              type="button"
              className={`btn-ghost !py-2 !px-4 text-sm ${
                expenseMonth?.paid ? "!border-[var(--primary)] !text-[var(--primary-deep)]" : "!border-[var(--accent)] !text-[var(--accent-deep)]"
              }`}
              onClick={() => setExpenseDetailOpen(true)}
            >
              {expenseMonth?.label || "Tháng này: …"}
            </button>
          </div>
        </div>
        <div className="panel overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">Ngày</th>
                <th className="p-3 font-medium">Tòa</th>
                <th className="p-3 font-medium">Danh mục</th>
                <th className="p-3 font-medium">Chu kỳ</th>
                <th className="p-3 font-medium">Hạn đóng</th>
                <th className="p-3 font-medium">Hạn tiếp theo</th>
                <th className="p-3 font-medium">Mô tả</th>
                <th className="p-3 font-medium">Số tiền</th>
                <th className="p-3 font-medium">Tình trạng</th>
                <th className="p-3 font-medium">Thời gian đóng</th>
                <th className="p-3 font-medium">Hình ảnh</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((ex) => {
                const needsPay = ex.status !== "paid";
                const canMarkPaid = Boolean(draftPaidAt[ex.id] && ex.image_url);
                return (
                <tr key={ex.id} className="border-t border-[var(--border)]">
                  <td className="p-3">{formatDate(ex.expense_date)}</td>
                  <td className="p-3">{propertyNameById.get(ex.property_id) || "—"}</td>
                  <td className="p-3">{ex.category}</td>
                  <td className="p-3">
                    {dueCycleLabel(ex.due_cycle)}
                    {ex.recurring === false ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">(1 lần)</span>
                    ) : null}
                  </td>
                  <td className={`p-3 ${dueAlertClass(ex.due_date)}`}>
                    {ex.due_date ? formatDate(ex.due_date) : "—"}
                  </td>
                  <td className={`p-3 ${dueAlertClass(ex.next_due_date)}`}>
                    {ex.next_due_date ? formatDate(ex.next_due_date) : "—"}
                  </td>
                  <td className="p-3">{ex.description || "—"}</td>
                  <td className="p-3">{formatVnd(ex.amount)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block size-3 rounded-sm ${
                          ex.status === "paid"
                            ? "bg-[var(--primary)]"
                            : ex.status === "collecting"
                              ? "bg-[var(--accent-deep)]"
                              : "bg-[var(--accent)]"
                        }`}
                      />
                      {expenseStatusLabel(ex.status)}
                    </span>
                  </td>
                  <td className="p-3">
                    {!needsPay ? (
                      formatDateTime(ex.paid_at)
                    ) : (
                      <DateTimeField
                        className="w-[12rem]"
                        value={draftPaidAt[ex.id] || ""}
                        onChange={(v) =>
                          setDraftPaidAt((prev) => ({ ...prev, [ex.id]: v }))
                        }
                      />
                    )}
                  </td>
                  <td className="p-3">
                    {ex.image_url ? (
                      <a href={`${API_BASE}${ex.image_url}`} target="_blank" rel="noreferrer">
                        <img
                          src={`${API_BASE}${ex.image_url}`}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover border border-[var(--border)]"
                        />
                      </a>
                    ) : (
                      <label className="text-xs text-[var(--primary)] cursor-pointer hover:underline">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadExpenseImage(ex.id, f);
                          }}
                        />
                      </label>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col items-start gap-1">
                      {needsPay ? (
                        <button
                          type="button"
                          disabled={!canMarkPaid}
                          title={
                            canMarkPaid
                              ? "Đánh dấu đã đóng"
                              : "Chọn thời gian đóng và upload hình ảnh"
                          }
                          className={`text-xs font-medium ${
                            canMarkPaid
                              ? "text-[var(--primary)] hover:underline"
                              : "text-[var(--muted)] cursor-not-allowed opacity-50"
                          }`}
                          onClick={() => markExpensePaid(ex.id)}
                        >
                          Đánh dấu đã đóng
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)] hover:text-[var(--primary)] hover:underline"
                        onClick={() => openJournal(ex)}
                      >
                        Sổ nhật ký
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!toast} onClose={() => setToast(null)} panelClassName="text-center">
        <h3 className="font-display text-xl font-semibold text-[var(--primary-deep)]">{toast?.title}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{toast?.detail}</p>
        <button type="button" className="btn-primary mt-5" onClick={() => setToast(null)}>
          Đóng
        </button>
      </Modal>

      <Modal open={monthOpen} onClose={() => setMonthOpen(false)} panelClassName="!w-[min(640px,100%)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Đã thu theo tháng</h3>
          <input
            type="month"
            className="field w-auto"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
          />
        </div>
        <div className="mt-4 overflow-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="p-2">Khách</th>
                <th className="p-2">Số HĐ</th>
                <th className="p-2">Số tiền</th>
                <th className="p-2">Ngày thu</th>
                <th className="p-2">PT</th>
              </tr>
            </thead>
            <tbody>
              {monthPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[var(--muted)]">
                    Chưa có thanh toán trong tháng này.
                  </td>
                </tr>
              ) : (
                monthPayments.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="p-2">{p.tenant_name || "—"}</td>
                    <td className="p-2">{p.invoice_no || "—"}</td>
                    <td className="p-2">{formatVnd(p.amount)}</td>
                    <td className="p-2">{formatDateTime(p.paid_at)}</td>
                    <td className="p-2">{p.method}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm font-medium">Tổng: {formatVnd(monthTotal)}</p>
          <button type="button" className="btn-ghost" onClick={() => setMonthOpen(false)}>
            Đóng
          </button>
        </div>
      </Modal>

      <Modal
        open={expenseCreateOpen}
        onClose={() => setExpenseCreateOpen(false)}
        panelClassName="!w-[min(520px,100%)]"
      >
        <form onSubmit={createExpense} className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-[var(--primary-deep)]">Thêm chi phí</h3>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Tòa *</span>
            <Select
              className="mt-1"
              value={expenseForm.property_id}
              onChange={(next) => setExpenseForm({ ...expenseForm, property_id: next })}
              required
              options={properties.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.property_type})`,
              }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Danh mục *</span>
            <Select
              className="mt-1"
              value={expenseForm.category}
              onChange={(next) => setExpenseForm({ ...expenseForm, category: next })}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Số tiền *</span>
            <input
              className="field mt-1"
              inputMode="numeric"
              placeholder="Ví dụ: 3500000"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Ngày *</span>
            <DateField
              className="mt-1"
              value={expenseForm.expense_date}
              onChange={(iso) => setExpenseForm({ ...expenseForm, expense_date: iso })}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Chu kỳ *</span>
            <Select
              className="mt-1"
              value={expenseForm.due_cycle}
              onChange={(next) =>
                setExpenseForm({
                  ...expenseForm,
                  due_cycle: next as "monthly" | "quarterly" | "yearly",
                })
              }
              options={DUE_CYCLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={expenseForm.recurring}
              onChange={(e) => setExpenseForm({ ...expenseForm, recurring: e.target.checked })}
            />
            <span>Lặp lại</span>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Hạn đóng *</span>
            <DateField
              className="mt-1"
              value={expenseForm.due_date}
              onChange={(iso) => setExpenseForm({ ...expenseForm, due_date: iso })}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Mô tả</span>
            <input
              className="field mt-1"
              placeholder="Ghi chú ngắn"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </label>
          {expenseFormError && (
            <p className="text-sm text-[var(--overdue)]">{expenseFormError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setExpenseCreateOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Lưu chi phí
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={expenseDetailOpen && !!expenseMonth} onClose={() => setExpenseDetailOpen(false)}>
        <h3 className="font-display text-lg font-semibold">{expenseMonth?.label}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tháng {expenseMonth ? String(expenseMonth.month).padStart(2, "0") : ""}/
          {expenseMonth?.year}: {expenseMonth?.total} khoản — còn {expenseMonth?.unpaid} chưa đóng.
        </p>
        <button type="button" className="btn-primary mt-5" onClick={() => setExpenseDetailOpen(false)}>
          Đóng
        </button>
      </Modal>

      <Modal
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        panelClassName="!w-[min(640px,100%)]"
      >
        <h3 className="font-display text-lg font-semibold text-[var(--primary-deep)]">
          Sổ nhật ký — {journalExpense?.category || "Chi phí"}
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {journalExpense
            ? `${propertyNameById.get(journalExpense.property_id) || ""} · ${formatVnd(journalExpense.amount)}`
            : ""}
        </p>
        <div className="mt-4 overflow-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="p-2">Hạn kỳ</th>
                <th className="p-2">Số tiền</th>
                <th className="p-2">Đóng lúc</th>
                <th className="p-2">Chứng từ</th>
              </tr>
            </thead>
            <tbody>
              {journalLoading ? (
                <tr>
                  <td colSpan={4} className="p-3 text-[var(--muted)]">
                    Đang tải…
                  </td>
                </tr>
              ) : journals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-[var(--muted)]">
                    Chưa có lần đóng nào trong sổ nhật ký.
                  </td>
                </tr>
              ) : (
                journals.map((j) => (
                  <tr key={j.id} className="border-t border-[var(--border)]">
                    <td className="p-2">{j.due_date ? formatDate(j.due_date) : "—"}</td>
                    <td className="p-2">{formatVnd(j.amount)}</td>
                    <td className="p-2">{formatDateTime(j.paid_at)}</td>
                    <td className="p-2">
                      {j.image_url ? (
                        <a
                          href={`${API_BASE}${j.image_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--primary)] hover:underline"
                        >
                          Xem
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-ghost" onClick={() => setJournalOpen(false)}>
            Đóng
          </button>
        </div>
      </Modal>
    </div>
  );
}
