import { useEffect, useRef } from "react";
import type { CalendarEventLike } from "../../lib/calendarRange";
import { eventKey, eventLabel } from "../../lib/calendarRange";
import { formatDate } from "../../lib/format";

type Props = {
  events: CalendarEventLike[];
  anonymous?: boolean;
  title?: string;
  onClose: () => void;
  /** Optional: when selecting one event from a day list */
  onSelectEvent?: (ev: CalendarEventLike) => void;
};

export function CalendarEventPopover({
  events,
  anonymous = false,
  title,
  onClose,
  onSelectEvent,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  if (events.length === 0) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className="absolute z-40 mt-1 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--primary-deep)]">
          {title ?? (events.length === 1 ? eventLabel(events[0], anonymous) : `${events.length} mục`)}
        </div>
        <button
          type="button"
          aria-label="Đóng"
          className="rounded-full px-1.5 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        {events.map((ev) => {
          const label = eventLabel(ev, anonymous);
          const isContract = ev.kind === "contract";
          const body = (
            <>
              {events.length > 1 ? (
                <div className="mb-1 truncate text-xs font-medium text-[var(--text)]">{label}</div>
              ) : null}
              <div className="text-xs text-[var(--muted)]">
                Từ <span className="font-medium text-[var(--text)]">{formatDate(ev.start_date)}</span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                Đến <span className="font-medium text-[var(--text)]">{formatDate(ev.end_date)}</span>
              </div>
            </>
          );

          if (onSelectEvent && events.length > 1) {
            return (
              <button
                key={eventKey(ev, ev.start_date)}
                type="button"
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition hover:border-[var(--primary)] ${
                  isContract ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-[var(--primary)]/30 bg-[var(--primary-soft)]"
                }`}
                onClick={() => onSelectEvent(ev)}
              >
                {body}
              </button>
            );
          }

          return (
            <div
              key={eventKey(ev, ev.start_date)}
              className={`rounded-lg border px-2.5 py-2 ${
                isContract ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-[var(--primary)]/30 bg-[var(--primary-soft)]"
              }`}
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
