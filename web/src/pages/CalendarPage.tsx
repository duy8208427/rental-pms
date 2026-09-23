import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CalendarBlock, Property } from "../api/types";
import { CalendarPeriodNav } from "../components/CalendarPeriodNav";
import { MonthDayGrid } from "../components/calendar/MonthDayGrid";
import { YearMonthGrid } from "../components/calendar/YearMonthGrid";
import { Select } from "../components/Select";
import {
  type CalendarViewMode,
  monthBounds,
  shiftMonth,
  todayParts,
  yearBounds,
} from "../lib/calendarRange";

export function CalendarPage() {
  const now = todayParts();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [mode, setMode] = useState<CalendarViewMode>("month");
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);

  const range = useMemo(
    () => (mode === "year" ? yearBounds(year) : monthBounds(year, month)),
    [mode, year, month],
  );

  useEffect(() => {
    api<Property[]>("/api/properties").then((p) => {
      setProperties(p);
      if (p[0]) setPropertyId(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    api<CalendarBlock[]>(
      `/api/calendar?property_id=${propertyId}&from=${range.from}&to=${range.to}`,
    ).then(setBlocks);
  }, [propertyId, range.from, range.to]);

  function onPrev() {
    if (mode === "year") setYear((y) => y - 1);
    else {
      const n = shiftMonth(year, month, -1);
      setYear(n.year);
      setMonth(n.month);
    }
  }

  function onNext() {
    if (mode === "year") setYear((y) => y + 1);
    else {
      const n = shiftMonth(year, month, 1);
      setYear(n.year);
      setMonth(n.month);
    }
  }

  function onToday() {
    const t = todayParts();
    setYear(t.year);
    setMonth(t.month);
    setMode("month");
  }

  return (
    <div
      className={`flex flex-col gap-2 ${
        mode === "month" ? "h-[calc(100dvh-3rem)] min-h-0" : "space-y-3"
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--primary-deep)] leading-tight">Lịch cho thuê</h1>
          <p className="text-xs text-[var(--muted)]">Booking và hợp đồng theo tháng / năm</p>
        </div>
        <Select
          className="w-auto min-w-[180px]"
          value={propertyId}
          onChange={setPropertyId}
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <div className="panel shrink-0 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CalendarPeriodNav
            mode={mode}
            onModeChange={setMode}
            year={year}
            month={month}
            onPrev={onPrev}
            onNext={onNext}
            onToday={onToday}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-[var(--primary)]" aria-hidden />
              Booking
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-[var(--accent)]" aria-hidden />
              Hợp đồng
            </span>
          </div>
        </div>
      </div>

      {mode === "month" ? (
        <MonthDayGrid year={year} month={month} blocks={blocks} fillHeight />
      ) : (
        <div className="min-h-0 overflow-auto">
          <YearMonthGrid
            year={year}
            blocks={blocks}
            onSelectMonth={(m) => {
              setMonth(m);
              setMode("month");
            }}
          />
        </div>
      )}
    </div>
  );
}
