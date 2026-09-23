/** Calendar period helpers — month/year navigation (local dates, no UTC shift). */

export type CalendarViewMode = "month" | "year";

export type CalendarEventKind = "booking" | "contract" | string;

export interface CalendarEventLike {
  unit_code: string;
  kind: CalendarEventKind;
  start_date: string;
  end_date: string;
  tenant_name?: string | null;
  occupancy_id?: string;
  unit_id?: string;
}

export type MonthGridCell = {
  date: string;
  day: number;
  month: number;
  year: number;
  inMonth: boolean;
};

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD from year/month/day (month 1–12). */
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayParts(): { year: number; month: number; day: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function todayYmd(): string {
  const t = todayParts();
  return ymd(t.year, t.month, t.day);
}

/** Inclusive month start, exclusive next-month start. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = ymd(year, month, 1);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const to = ymd(next.y, next.m, 1);
  return { from, to };
}

/** Inclusive year start, exclusive next-year start. */
export function yearBounds(year: number): { from: string; to: string } {
  return { from: ymd(year, 1, 1), to: ymd(year + 1, 1, 1) };
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || to <= from) return out;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const d = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (d < end) {
    out.push(ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Google-style label: "Tháng 11, 2026" */
export function monthLabel(year: number, month: number): string {
  return `Tháng ${month}, ${year}`;
}

export const WEEKDAY_LABELS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;
export const WEEKDAY_LABELS_SHORT_VI = ["Cn", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export const MONTH_NAMES_VI = [
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

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Up to 6×7 cells starting Sunday, including adjacent-month days. */
export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month - 1, 1 - startOffset);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    cells.push({
      date: ymd(y, m, day),
      day,
      month: m,
      year: y,
      inMonth: m === month && y === year,
    });
  }
  // Drop trailing weeks with no days of the target month (saves a full row).
  let lastWeek = 5;
  while (lastWeek > 0) {
    const week = cells.slice(lastWeek * 7, lastWeek * 7 + 7);
    if (week.some((c) => c.inMonth)) break;
    lastWeek -= 1;
  }
  return cells.slice(0, (lastWeek + 1) * 7);
}

/** Half-open occupancy: start_date <= day < end_date */
export function blocksOnDay<T extends CalendarEventLike>(blocks: T[], date: string): T[] {
  return blocks.filter((b) => b.start_date <= date && date < b.end_date);
}

export function dayHasKind(blocks: CalendarEventLike[], date: string): {
  booking: boolean;
  contract: boolean;
} {
  let booking = false;
  let contract = false;
  for (const b of blocksOnDay(blocks, date)) {
    if (b.kind === "contract") contract = true;
    else booking = true;
    if (booking && contract) break;
  }
  return { booking, contract };
}

export function eventLabel(ev: CalendarEventLike, anonymous: boolean): string {
  if (anonymous) {
    return `${ev.unit_code} · ${ev.kind === "contract" ? "Hợp đồng" : "Booking"}`;
  }
  const name = ev.tenant_name?.trim() || (ev.kind === "contract" ? "Hợp đồng" : "Booking");
  return `${ev.unit_code} · ${name}`;
}

export function eventKey(ev: CalendarEventLike, date: string): string {
  return `${ev.occupancy_id ?? ev.unit_id ?? ev.unit_code}-${ev.start_date}-${ev.end_date}-${date}`;
}
