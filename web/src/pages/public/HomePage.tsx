import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import type { Property } from "../../api/types";
import { BookingWizardModal } from "../../components/BookingWizardModal";
import { useUiChrome } from "../../ui/UiChromeContext";

const TYPE_LABEL: Record<string, string> = {
  hotel: "Khách sạn",
  office: "Văn phòng",
  workshop: "Xưởng",
  mixed: "Hỗn hợp",
};

const TYPE_TONE: Record<string, string> = {
  hotel: "#0d7377",
  office: "#3d6b8c",
  workshop: "#c9784a",
  mixed: "#5a7378",
};

export function HomePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPropertyId, setWizardPropertyId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const { setBookingWizardOpen } = useUiChrome();

  useEffect(() => {
    setBookingWizardOpen(wizardOpen);
    return () => setBookingWizardOpen(false);
  }, [wizardOpen, setBookingWizardOpen]);

  useEffect(() => {
    api<Property[]>("/api/public/properties")
      .then(setProperties)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (params.get("book") === "1") {
      setWizardPropertyId(params.get("property"));
      setWizardOpen(true);
      const next = new URLSearchParams(params);
      next.delete("book");
      next.delete("property");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  function openWizard(propertyId?: string) {
    setWizardPropertyId(propertyId || null);
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setWizardPropertyId(null);
  }

  return (
    <div>
      <section className="hero-shell">
        <div
          className="hero-media"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80)",
          }}
        />
        <div className="hero-content">
          <p className="animate-fade-up text-[11px] uppercase tracking-[0.28em] text-white/75 mb-3">
            Harbor Stay
          </p>
          <h1 className="animate-fade-up font-display text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1.05] max-w-2xl">
            Không gian thuê tinh tế cho kỳ nghỉ và công việc
          </h1>
          <p className="animate-fade-up-delay mt-4 max-w-lg text-white/80 text-base sm:text-lg">
            Chọn ngày, xem phòng trống và đặt trực tuyến trong vài bước.
          </p>
          <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => openWizard()}>
              Tìm phòng trống
            </button>
            <Link to="/lich" className="btn-ghost !border-white/35 !text-white hover:!bg-white/10 no-underline">
              Xem lịch phòng
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[1120px] mx-auto px-4 py-14 space-y-8">
        <div className="animate-fade-up max-w-xl">
          <h2 className="page-title">Cơ sở cho thuê</h2>
          <p className="page-sub">
            Khách sạn, văn phòng và xưởng — chọn cơ sở để bắt đầu đặt phòng.
          </p>
        </div>

        {error && (
          <div className="text-sm text-[var(--overdue)] bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openWizard(p.id)}
              className="panel text-left p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)] animate-fade-up"
              style={{
                animationDelay: `${0.05 * i}s`,
                borderTop: `3px solid ${TYPE_TONE[p.property_type] || "var(--primary)"}`,
              }}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                {TYPE_LABEL[p.property_type] || p.property_type}
              </div>
              <div className="font-display text-xl font-semibold mt-2 text-[var(--primary-deep)]">
                {p.name}
              </div>
              <div className="text-sm text-[var(--muted)] mt-3 leading-relaxed">
                {[p.address, p.city].filter(Boolean).join(", ") || "Địa chỉ đang cập nhật"}
              </div>
              <div className="mt-5 text-sm font-semibold text-[var(--primary)]">Đặt tại đây →</div>
            </button>
          ))}
        </div>
      </section>

      <BookingWizardModal
        open={wizardOpen}
        initialPropertyId={wizardPropertyId}
        onClose={closeWizard}
      />
    </div>
  );
}
