import { useState } from "react";
import {
  type CalendarEventLike,
  WEEKDAY_LABELS_VI,
  blocksOnDay,
  buildMonthGrid,
  eventKey,
  eventLabel,
  todayYmd,
} from "../../lib/calendarRange";
import { CalendarEventPopover } from "./CalendarEventPopover";

type Props = {
  year: number;
  month: number;
  blocks: CalendarEventLike[];
  anonymous?: boolean;
  maxPills?: number;
  /** Fill remaining viewport height (no page scroll for the grid). */
  fillHeight?: boolean;
};

type PopoverState =
  | { kind: "event"; event: CalendarEventLike; anchorDate: string }
  | { kind: "day"; date: string; events: CalendarEventLike[] };

export function MonthDayGrid({
  year,
  month,
  blocks,
  anonymous = false,
  maxPills = 2,
  fillHeight = true,
}: Props) {
  const cells = buildMonthGrid(year, month);
  const weekCount = Math.ceil(cells.length / 7);
  const today = todayYmd();
  const [popover, setPopover] = useState<PopoverState | null>(null);

  return (
    <div
      className={`panel overflow-visible flex flex-col min-h-0 ${fillHeight ? "flex-1" : ""}`}
    >
      <div className="grid shrink-0 grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-soft)]">
        {WEEKDAY_LABELS_VI.map((w) => (
          <div
            key={w}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
          >
            {w}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const dayBlocks = blocksOnDay(blocks, cell.date);
          const visible = dayBlocks.slice(0, maxPills);
          const overflow = dayBlocks.length - visible.length;
          const isToday = cell.date === today;
          const showHere =
            popover &&
            ((popover.kind === "event" && popover.anchorDate === cell.date) ||
              (popover.kind === "day" && popover.date === cell.date));

          return (
            <div
              key={cell.date}
              className={`relative min-h-0 border-b border-r border-[var(--border)] p-0.5 sm:p-1 ${
                cell.inMonth ? "bg-white" : "bg-[var(--surface-soft)]/60"
              }`}
            >
              <div className="mb-0.5 flex justify-end">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-none ${
                    isToday
                      ? "bg-[var(--primary)] font-semibold text-white"
                      : cell.inMonth
                        ? "text-[var(--text)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {cell.day === 1 ? (
                    <span className="text-[9px] whitespace-nowrap">
                      {cell.day} thg {cell.month}
                    </span>
                  ) : (
                    cell.day
                  )}
                </span>
              </div>
              <div className="space-y-px">
                {visible.map((ev) => {
                  const label = eventLabel(ev, anonymous);
                  const isContract = ev.kind === "contract";
                  const active =
                    popover?.kind === "event" &&
                    popover.anchorDate === cell.date &&
                    eventKey(popover.event, cell.date) === eventKey(ev, cell.date);
                  return (
                    <button
                      key={eventKey(ev, cell.date)}
                      type="button"
                      title={`${label} · ${ev.start_date} → ${ev.end_date}`}
                      className={`block w-full truncate rounded px-1 py-px text-left text-[9px] sm:text-[10px] font-medium leading-tight text-white ${
                        isContract ? "bg-[var(--accent)]" : "bg-[var(--primary)]"
                      } ${active ? "ring-1 ring-offset-0 ring-[var(--primary-deep)]" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopover({ kind: "event", event: ev, anchorDate: cell.date });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                {overflow > 0 ? (
                  <button
                    type="button"
                    className="px-0.5 text-left text-[9px] font-medium text-[var(--muted)] hover:text-[var(--primary-deep)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopover({ kind: "day", date: cell.date, events: dayBlocks });
                    }}
                  >
                    +{overflow}
                  </button>
                ) : null}
              </div>

              {showHere ? (
                <div className="absolute left-0 right-0 top-6 z-40 px-0.5">
                  <CalendarEventPopover
                    events={popover.kind === "event" ? [popover.event] : popover.events}
                    anonymous={anonymous}
                    title={
                      popover.kind === "day"
                        ? `${cell.day}/${cell.month}/${cell.year}`
                        : undefined
                    }
                    onClose={() => setPopover(null)}
                    onSelectEvent={
                      popover.kind === "day"
                        ? (ev) => setPopover({ kind: "event", event: ev, anchorDate: cell.date })
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
