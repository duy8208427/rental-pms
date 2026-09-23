import type { CalendarViewMode } from "../lib/calendarRange";
import { monthLabel } from "../lib/calendarRange";

type Props = {
  mode: CalendarViewMode;
  onModeChange: (mode: CalendarViewMode) => void;
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function CalendarPeriodNav({
  mode,
  onModeChange,
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToday}
        className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary-deep)]"
      >
        Hôm nay
      </button>

      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Trước"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary-deep)]"
          onClick={onPrev}
        >
          ‹
        </button>
        <div className="min-w-[120px] text-center text-sm font-semibold text-[var(--primary-deep)]">
          {mode === "month" ? monthLabel(year, month) : String(year)}
        </div>
        <button
          type="button"
          aria-label="Sau"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary-deep)]"
          onClick={onNext}
        >
          ›
        </button>
      </div>

      <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-0.5">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            mode === "month"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
          onClick={() => onModeChange("month")}
        >
          Tháng
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            mode === "year"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
          onClick={() => onModeChange("year")}
        >
          Năm
        </button>
      </div>
    </div>
  );
}
