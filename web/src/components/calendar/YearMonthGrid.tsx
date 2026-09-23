import { useState } from "react";
import {
  type CalendarEventLike,
  MONTH_NAMES_VI,
  WEEKDAY_LABELS_SHORT_VI,
  blocksOnDay,
  buildMonthGrid,
  dayHasKind,
  todayParts,
  todayYmd,
} from "../../lib/calendarRange";
import { formatDate } from "../../lib/format";
import { CalendarEventPopover } from "./CalendarEventPopover";

type Props = {
  year: number;
  blocks: CalendarEventLike[];
  anonymous?: boolean;
  onSelectMonth: (month: number) => void;
};

type DayPopover = { date: string; month: number; events: CalendarEventLike[] };

export function YearMonthGrid({ year, blocks, anonymous = false, onSelectMonth }: Props) {
  const today = todayYmd();
  const now = todayParts();
  const [dayPopover, setDayPopover] = useState<DayPopover | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {MONTH_NAMES_VI.map((name, i) => {
        const month = i + 1;
        const cells = buildMonthGrid(year, month);
        return (
          <div
            key={name}
            className="panel relative p-3 text-left transition hover:border-[var(--primary)] hover:shadow-sm"
          >
            <button
              type="button"
              onClick={() => onSelectMonth(month)}
              className="mb-2 text-sm font-semibold text-[var(--primary-deep)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded"
            >
              {name}
            </button>
            <div className="grid grid-cols-7 gap-y-0.5">
              {WEEKDAY_LABELS_SHORT_VI.map((w) => (
                <div key={w} className="text-center text-[9px] font-medium text-[var(--muted)]">
                  {w}
                </div>
              ))}
              {cells.map((cell) => {
                const kinds = dayHasKind(blocks, cell.date);
                const occupied = kinds.booking || kinds.contract;
                const dayEvents = occupied ? blocksOnDay(blocks, cell.date) : [];
                const isToday = cell.date === today;
                const isCurrentMonthToday = now.year === year && now.month === month && isToday;
                const active = dayPopover?.date === cell.date;

                let dayClass =
                  "mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px]";
                if (!cell.inMonth) {
                  dayClass += " text-[var(--muted)]/50";
                } else if (isCurrentMonthToday) {
                  dayClass += " bg-[var(--primary)] font-semibold text-white";
                } else if (kinds.contract && kinds.booking) {
                  dayClass +=
                    " font-medium text-[var(--primary-deep)] ring-2 ring-[var(--accent)] bg-[var(--primary-soft)]";
                } else if (kinds.contract) {
                  dayClass += " font-medium text-[var(--accent-deep,#9a5b2e)] bg-[var(--accent)]/25";
                } else if (kinds.booking) {
                  dayClass += " font-medium text-[var(--primary-deep)] bg-[var(--primary-soft)]";
                } else {
                  dayClass += " text-[var(--text)]";
                }
                if (active) dayClass += " outline outline-2 outline-offset-1 outline-[var(--primary)]";

                if (!cell.inMonth) {
                  return (
                    <div key={cell.date} className={dayClass}>
                      {cell.day}
                    </div>
                  );
                }

                return (
                  <button
                    key={cell.date}
                    type="button"
                    title={
                      dayEvents.length
                        ? dayEvents
                            .map(
                              (e) =>
                                `${e.unit_code}: ${formatDate(e.start_date)} → ${formatDate(e.end_date)}`,
                            )
                            .join("\n")
                        : undefined
                    }
                    className={dayClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (occupied) {
                        setDayPopover({ date: cell.date, month, events: dayEvents });
                      } else {
                        onSelectMonth(month);
                      }
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {dayPopover?.month === month ? (
              <div className="absolute left-3 right-3 top-10 z-30">
                <CalendarEventPopover
                  events={dayPopover.events}
                  anonymous={anonymous}
                  title={`${Number(dayPopover.date.slice(8))}/${month}/${year}`}
                  onClose={() => setDayPopover(null)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
