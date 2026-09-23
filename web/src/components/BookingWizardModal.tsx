import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Property } from "../api/types";
import { formatDate, formatVnd } from "../lib/format";
import {
  emailError,
  personNameError,
  phoneError,
  sanitizeDigits,
} from "../lib/validation";
import { Select } from "./Select";

type PublicUnit = {
  id: string;
  property_id: string;
  code: string;
  name: string;
  floor: number;
  capacity: number;
  price_per_night?: number | null;
  total_estimate?: number | null;
};

type BookingResult = {
  booking_id: string;
  unit_code: string;
  property_name?: string;
  guest_name: string;
  start_date: string;
  end_date: string;
  nights: number;
  total_amount: number;
  message: string;
};

type Step = 1 | 2 | 3 | 4;

const STEP_TITLE: Record<Step, string> = {
  1: "Chọn ngày & cơ sở",
  2: "Chọn phòng",
  3: "Thông tin khách",
  4: "Đặt phòng thành công",
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  open: boolean;
  initialPropertyId?: string | null;
  onClose: () => void;
};

export function BookingWizardModal({ open, initialPropertyId, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState(initialPropertyId || "");
  const [from, setFrom] = useState(todayPlus(0));
  const [to, setTo] = useState(todayPlus(2));
  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [selected, setSelected] = useState<PublicUnit | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    guests: "2",
    adults: "2",
    children: "0",
    notes: "",
  });
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId) || null,
    [properties, propertyId],
  );
  const isHotel = selectedProperty?.property_type === "hotel";

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setUnits([]);
    setSelected(null);
    setResult(null);
    setError("");
    setFrom(todayPlus(0));
    setTo(todayPlus(2));
    setForm({ full_name: "", phone: "", email: "", guests: "2", adults: "2", children: "0", notes: "" });
    api<Property[]>("/api/public/properties").then((list) => {
      setProperties(list);
      const preferred = initialPropertyId && list.some((p) => p.id === initialPropertyId)
        ? initialPropertyId
        : list[0]?.id || "";
      setPropertyId(preferred);
    });
  }, [open, initialPropertyId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const nights = useMemo(() => {
    const a = new Date(from);
    const b = new Date(to);
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  }, [from, to]);

  async function goToRooms() {
    setError("");
    if (!propertyId || nights < 1) {
      setError("Chọn cơ sở và khoảng ngày hợp lệ (ít nhất 1 đêm)");
      return;
    }
    setBusy(true);
    try {
      const data = await api<PublicUnit[]>(
        `/api/public/units?property_id=${propertyId}&from=${from}&to=${to}`,
      );
      setUnits(data);
      setSelected(null);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tìm được phòng");
    } finally {
      setBusy(false);
    }
  }

  async function submitBooking() {
    if (!selected) return;
    const full_name = form.full_name.trim();
    const phone = sanitizeDigits(form.phone);
    const email = form.email.trim();
    const fieldErr = personNameError(full_name) || phoneError(phone) || emailError(email);
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
    const adults = Math.max(1, Number(form.adults) || 1);
    const children = Math.max(0, Number(form.children) || 0);
    const guests = isHotel ? adults + children : Math.max(1, Number(form.guests) || 1);
    if (guests > selected.capacity) {
      setError(`Phòng tối đa ${selected.capacity} khách`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<BookingResult>("/api/public/bookings", {
        method: "POST",
        body: JSON.stringify({
          unit_id: selected.id,
          start_date: from,
          end_date: to,
          guests,
          adults: isHotel ? adults : guests,
          children: isHotel ? children : 0,
          full_name,
          phone,
          email,
          notes: form.notes || null,
        }),
      });
      setResult(data);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt phòng thất bại");
    } finally {
      setBusy(false);
    }
  }

  function resetAndBookAgain() {
    setStep(1);
    setUnits([]);
    setSelected(null);
    setResult(null);
    setError("");
    setForm({ full_name: "", phone: "", email: "", guests: "2", adults: "2", children: "0", notes: "" });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(8,40,42,0.55)] backdrop-blur-[2px] animate-soft-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 4) onClose();
      }}
    >
      <div className="panel w-full max-w-lg flex flex-col max-h-[min(90vh,640px)] overflow-hidden animate-fade-up">
        <header className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 bg-[linear-gradient(135deg,#f3faf9,#fff)]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Bước {step}/4
            </div>
            <h2 id="booking-wizard-title" className="font-display text-xl font-semibold mt-0.5 text-[var(--primary-deep)]">
              {STEP_TITLE[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            aria-label="Đóng"
          >
            Đóng
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm text-[var(--overdue)] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Cơ sở</span>
                <Select
                  className="mt-1"
                  value={propertyId}
                  onChange={setPropertyId}
                  options={properties.map((p) => ({ value: p.id, label: p.name }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Nhận phòng</span>
                  <input
                    type="date"
                    className="field mt-1"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Trả phòng</span>
                  <input
                    type="date"
                    className="field mt-1"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <p className="text-sm text-[var(--muted)]">{nights} đêm</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {units.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Không còn phòng trống trong khoảng ngày này.</p>
              ) : (
                <div className="grid gap-2">
                  {units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelected(u)}
                      className={`choice-card w-full ${
                        selected?.id === u.id ? "is-selected" : ""
                      }`}
                    >
                      <div className="font-semibold text-[var(--primary-deep)]">
                        {u.code} · {u.name}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Tầng {u.floor} · tối đa {u.capacity} khách
                      </div>
                      <div className="text-sm mt-2 font-medium">
                        {formatVnd(u.price_per_night || 0)}/đêm · {formatVnd(u.total_estimate || 0)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && selected && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Phòng <span className="font-medium text-[var(--text)]">{selected.code}</span> ·{" "}
                {formatDate(from)} → {formatDate(to)} · {formatVnd(selected.total_estimate || 0)}
              </p>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Họ tên *</span>
                <input
                  className="field mt-1"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Số điện thoại *</span>
                <input
                  className="field mt-1"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value) })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Email *</span>
                <input
                  type="email"
                  className="field mt-1"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              {isHotel ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">Người lớn *</span>
                    <input
                      type="number"
                      min={1}
                      max={selected.capacity}
                      className="field mt-1"
                      value={form.adults}
                      onChange={(e) => setForm({ ...form, adults: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">Trẻ em</span>
                    <input
                      type="number"
                      min={0}
                      max={selected.capacity}
                      className="field mt-1"
                      value={form.children}
                      onChange={(e) => setForm({ ...form, children: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Số khách</span>
                  <input
                    type="number"
                    min={1}
                    max={selected.capacity}
                    className="field mt-1"
                    value={form.guests}
                    onChange={(e) => setForm({ ...form, guests: e.target.value })}
                  />
                </label>
              )}
              {isHotel ? (
                <p className="text-xs text-[var(--muted)]">
                  Tổng {(Number(form.adults) || 0) + (Number(form.children) || 0)} khách · tối đa{" "}
                  {selected.capacity}
                </p>
              ) : null}
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Ghi chú</span>
                <textarea
                  className="field mt-1"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
          )}

          {step === 4 && result && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--vacant)] font-medium">{result.message}</p>
              <p className="font-display text-lg font-semibold">Cảm ơn bạn, {result.guest_name}</p>
              <dl className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Mã đặt</dt>
                  <dd className="font-mono text-xs">{result.booking_id.slice(0, 8).toUpperCase()}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Cơ sở</dt>
                  <dd>{result.property_name || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Phòng</dt>
                  <dd className="font-medium">{result.unit_code}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Nhận → trả</dt>
                  <dd>
                    {formatDate(result.start_date)} → {formatDate(result.end_date)} ({result.nights} đêm)
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Tổng ước tính</dt>
                  <dd className="font-medium">{formatVnd(result.total_amount)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <footer
          className="shrink-0 px-5 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-3 bg-white"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          {step === 4 ? (
            <>
              <button type="button" className="btn-ghost" onClick={resetAndBookAgain}>
                Đặt thêm
              </button>
              <button type="button" className="btn-primary" onClick={onClose}>
                Đóng
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost disabled:opacity-40"
                disabled={step === 1 || busy}
                onClick={() => {
                  setError("");
                  setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
                }}
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={busy || (step === 2 && !selected)}
                className="btn-primary disabled:opacity-60"
                onClick={() => {
                  if (step === 1) void goToRooms();
                  else if (step === 2) {
                    setError("");
                    setStep(3);
                  } else if (step === 3) void submitBooking();
                }}
              >
                {busy ? "Đang xử lý…" : step === 3 ? "Xác nhận đặt" : "Tiếp tục"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
