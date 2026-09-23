import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string; // YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): { date: string; hour: number; minute: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], hour: Number(m[2]), minute: Number(m[3]) };
}

function toValue(date: string, hour: number, minute: number): string {
  return `${date}T${pad2(hour)}:${pad2(minute)}`;
}

function formatDisplay(value: string): string {
  const p = parseValue(value);
  if (!p) return "";
  const [y, m, d] = p.date.split("-");
  return `${d}/${m}/${y} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const start = new Date(year, month - 1, 1 - startOffset);
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    cells.push({
      date: ymd(yy, mm, dd),
      day: dd,
      inMonth: mm === month && yy === year,
    });
  }
  // trim trailing empty weeks
  let last = 5;
  while (last > 0) {
    const week = cells.slice(last * 7, last * 7 + 7);
    if (week.some((c) => c.inMonth)) break;
    last -= 1;
  }
  return cells.slice(0, (last + 1) * 7);
}

function todayParts() {
  const n = new Date();
  return {
    year: n.getFullYear(),
    month: n.getMonth() + 1,
    date: ymd(n.getFullYear(), n.getMonth() + 1, n.getDate()),
    hour: n.getHours(),
    minute: n.getMinutes(),
  };
}

export function DateTimeField({ value, onChange, className = "", disabled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const today = todayParts();

  const [viewYear, setViewYear] = useState(parsed ? Number(parsed.date.slice(0, 4)) : today.year);
  const [viewMonth, setViewMonth] = useState(
    parsed ? Number(parsed.date.slice(5, 7)) : today.month,
  );
  const [selDate, setSelDate] = useState(parsed?.date || today.date);
  const [selHour, setSelHour] = useState(parsed?.hour ?? today.hour);
  const [selMinute, setSelMinute] = useState(parsed?.minute ?? today.minute);

  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setSelDate(p.date);
      setSelHour(p.hour);
      setSelMinute(p.minute);
      setViewYear(Number(p.date.slice(0, 4)));
      setViewMonth(Number(p.date.slice(5, 7)));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  function commit(date: string, hour: number, minute: number) {
    onChange(toValue(date, hour, minute));
  }

  function shiftMonth(delta: number) {
    const idx = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(idx / 12));
    setViewMonth((idx % 12) + 1);
  }

  function pickToday() {
    const t = todayParts();
    setViewYear(t.year);
    setViewMonth(t.month);
    setSelDate(t.date);
    setSelHour(t.hour);
    setSelMinute(t.minute);
    commit(t.date, t.hour, t.minute);
  }

  function clear() {
    onChange("");
    setOpen(false);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className={`hs-datetime-field ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        className="hs-datetime-trigger field text-left text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? "text-[var(--text)]" : "text-[var(--muted)]"}>
          {value ? formatDisplay(value) : "dd/mm/yyyy hh:mm"}
        </span>
      </button>

      {open ? (
        <div className="hs-datetime-popover" role="dialog" aria-label="Chọn thời gian">
          <div className="hs-datetime-calendar">
            <div className="hs-datetime-cal-header">
              <button type="button" className="hs-datetime-nav" onClick={() => shiftMonth(-1)} aria-label="Tháng trước">
                ‹
              </button>
              <div className="hs-datetime-month-label">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </div>
              <button type="button" className="hs-datetime-nav" onClick={() => shiftMonth(1)} aria-label="Tháng sau">
                ›
              </button>
            </div>
            <div className="hs-datetime-weekdays">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="hs-datetime-days">
              {cells.map((c) => {
                const selected = c.date === selDate;
                return (
                  <button
                    key={c.date}
                    type="button"
                    className={`hs-datetime-day ${!c.inMonth ? "is-muted" : ""} ${selected ? "is-selected" : ""} ${
                      c.date === today.date ? "is-today" : ""
                    }`}
                    onClick={() => {
                      setSelDate(c.date);
                      commit(c.date, selHour, selMinute);
                    }}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
            <div className="hs-datetime-footer">
              <button type="button" className="hs-datetime-link" onClick={clear}>
                Xóa
              </button>
              <button type="button" className="hs-datetime-link" onClick={pickToday}>
                Hôm nay
              </button>
            </div>
          </div>

          <div className="hs-datetime-time">
            <div className="hs-datetime-time-col">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`hs-datetime-time-item ${h === selHour ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelHour(h);
                    commit(selDate, h, selMinute);
                  }}
                >
                  {pad2(h)}
                </button>
              ))}
            </div>
            <div className="hs-datetime-time-col">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`hs-datetime-time-item ${m === selMinute ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelMinute(m);
                    commit(selDate, selHour, m);
                  }}
                >
                  {pad2(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
