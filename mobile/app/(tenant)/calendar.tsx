import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { colors, radius } from "../../src/theme";
import { Card, Muted, Screen, SectionTitle } from "../../src/ui";

type Property = {
  id: string;
  name: string;
  property_type: string;
};

type Block = {
  unit_id: string;
  unit_code: string;
  property_id?: string | null;
  kind: string;
  status: string;
  start_date: string;
  end_date: string;
};

type ViewMode = "month" | "year";

type MonthGridCell = {
  date: string;
  day: number;
  month: number;
  year: number;
  inMonth: boolean;
};

const WEEKDAY_SHORT = ["Cn", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
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

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function todayYmd(): string {
  const t = todayParts();
  return ymd(t.year, t.month, t.day);
}

function monthBounds(year: number, month: number) {
  const from = ymd(year, month, 1);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { from, to: ymd(next.y, next.m, 1) };
}

function yearBounds(year: number) {
  return { from: ymd(year, 1, 1), to: ymd(year + 1, 1, 1) };
}

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
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
  return cells;
}

function blocksOnDay(blocks: Block[], date: string) {
  return blocks.filter((b) => b.start_date <= date && date < b.end_date);
}

function dayHasKind(blocks: Block[], date: string) {
  let booking = false;
  let contract = false;
  for (const b of blocksOnDay(blocks, date)) {
    if (b.kind === "contract") contract = true;
    else booking = true;
  }
  return { booking, contract };
}

function eventLabel(b: Block) {
  return `${b.unit_code} · ${b.kind === "contract" ? "Hợp đồng" : "Booking"}`;
}

function formatDate(s: string): string {
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

function showEventRange(b: Block) {
  Alert.alert(eventLabel(b), `Từ ${formatDate(b.start_date)}\nĐến ${formatDate(b.end_date)}`);
}

function showDayEvents(dayBlocks: Block[], dateLabel: string) {
  if (dayBlocks.length === 0) return;
  if (dayBlocks.length === 1) {
    showEventRange(dayBlocks[0]);
    return;
  }
  Alert.alert(
    dateLabel,
    dayBlocks
      .map((b) => `${eventLabel(b)}\nTừ ${formatDate(b.start_date)} → Đến ${formatDate(b.end_date)}`)
      .join("\n\n"),
  );
}

export default function TenantCalendar() {
  const now = todayParts();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [mode, setMode] = useState<ViewMode>("month");
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const range = useMemo(
    () => (mode === "year" ? yearBounds(year) : monthBounds(year, month)),
    [mode, year, month],
  );

  useFocusEffect(
    useCallback(() => {
      api<Property[]>("/api/public/properties").then((p) => {
        setProperties(p);
        if (p[0]) setPropertyId(p[0].id);
      });
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!propertyId) return;
      api<Block[]>(`/api/public/calendar?property_id=${propertyId}&from=${range.from}&to=${range.to}`).then(
        setBlocks,
      );
    }, [propertyId, range.from, range.to]),
  );

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

  const periodLabel = mode === "month" ? `Tháng ${month}, ${year}` : String(year);
  const today = todayYmd();
  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <Screen>
      <SectionTitle icon="calendar-outline">Lịch cho thuê</SectionTitle>
      <Muted style={{ marginBottom: 4 }}>Ẩn danh — KS · văn phòng · xưởng</Muted>

      <ScrollView horizontal style={{ marginTop: 12 }} showsHorizontalScrollIndicator={false}>
        {properties.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPropertyId(p.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginRight: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: propertyId === p.id ? colors.primary : colors.border,
              backgroundColor: propertyId === p.id ? colors.primarySoft : colors.surface,
            }}
          >
            <Text style={{ color: propertyId === p.id ? colors.primaryDeep : colors.text, fontWeight: "600" }}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={onToday}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Hôm nay</Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              onPress={onPrev}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, color: colors.text }}>‹</Text>
            </Pressable>
            <Text style={{ minWidth: 110, textAlign: "center", fontWeight: "700", color: colors.primaryDeep }}>
              {periodLabel}
            </Text>
            <Pressable
              onPress={onNext}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, color: colors.text }}>›</Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSoft,
              padding: 2,
            }}
          >
            {(["month", "year"] as ViewMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: mode === m ? colors.primary : "transparent",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: mode === m ? colors.white : colors.muted }}>
                  {m === "month" ? "Tháng" : "Năm"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: colors.primary }} />
            <Text style={{ fontSize: 13, color: colors.text }}>Booking</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: colors.accent }} />
            <Text style={{ fontSize: 13, color: colors.text }}>Hợp đồng</Text>
          </View>
        </View>
      </Card>

      {mode === "month" ? (
        <View
          style={{
            marginTop: 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceSoft,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            {WEEKDAY.map((w) => (
              <View key={w} style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>{w}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: 6 }, (_, week) => (
            <View
              key={week}
              style={{
                flexDirection: "row",
                borderBottomWidth: week < 5 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              {monthCells.slice(week * 7, week * 7 + 7).map((cell) => {
                const dayBlocks = blocksOnDay(blocks, cell.date);
                const visible = dayBlocks.slice(0, 2);
                const overflow = dayBlocks.length - visible.length;
                const isToday = cell.date === today;
                return (
                  <View
                    key={cell.date}
                    style={{
                      flex: 1,
                      minHeight: 88,
                      padding: 4,
                      backgroundColor: cell.inMonth ? colors.surface : colors.surfaceSoft,
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    <View style={{ alignItems: "flex-end", marginBottom: 2 }}>
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 4,
                          backgroundColor: isToday ? colors.primary : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: isToday ? "700" : "500",
                            color: isToday ? colors.white : cell.inMonth ? colors.text : colors.muted,
                          }}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    </View>
                    {visible.map((b, i) => (
                      <Pressable
                        key={`${b.unit_id}-${b.start_date}-${i}`}
                        onPress={() => showEventRange(b)}
                        style={{
                          backgroundColor: b.kind === "contract" ? colors.accent : colors.primary,
                          borderRadius: 4,
                          paddingHorizontal: 3,
                          paddingVertical: 1,
                          marginBottom: 2,
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 8, color: colors.white, fontWeight: "600" }}>
                          {eventLabel(b)}
                        </Text>
                      </Pressable>
                    ))}
                    {overflow > 0 ? (
                      <Pressable
                        onPress={() => showDayEvents(dayBlocks, `${cell.day}/${cell.month}/${cell.year}`)}
                      >
                        <Text style={{ fontSize: 9, color: colors.muted }}>+{overflow}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const cells = buildMonthGrid(year, m);
            return (
              <View
                key={name}
                style={{
                  width: "47%",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    setMonth(m);
                    setMode("month");
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.primaryDeep, marginBottom: 6, fontSize: 13 }}>
                    {name}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row" }}>
                  {WEEKDAY_SHORT.map((w) => (
                    <View key={w} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ fontSize: 8, color: colors.muted, fontWeight: "600" }}>{w}</Text>
                    </View>
                  ))}
                </View>
                {Array.from({ length: 6 }, (_, week) => (
                  <View key={week} style={{ flexDirection: "row" }}>
                    {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                      const kinds = dayHasKind(blocks, cell.date);
                      const occupied = kinds.booking || kinds.contract;
                      const dayEvents = occupied ? blocksOnDay(blocks, cell.date) : [];
                      const isTodayCell = cell.date === today;
                      let bg = "transparent";
                      let color = cell.inMonth ? colors.text : colors.border;
                      if (isTodayCell && cell.inMonth) {
                        bg = colors.primary;
                        color = colors.white;
                      } else if (kinds.contract) {
                        bg = "rgba(232,168,124,0.35)";
                        color = colors.accentDeep;
                      } else if (kinds.booking) {
                        bg = colors.primarySoft;
                        color = colors.primaryDeep;
                      }
                      return (
                        <Pressable
                          key={cell.date}
                          style={{ flex: 1, alignItems: "center", paddingVertical: 1 }}
                          onPress={() => {
                            if (!cell.inMonth) return;
                            if (occupied) {
                              showDayEvents(dayEvents, `${cell.day}/${m}/${year}`);
                            } else {
                              setMonth(m);
                              setMode("month");
                            }
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: bg,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                color,
                                fontWeight: kinds.booking || kinds.contract || isTodayCell ? "700" : "400",
                              }}
                            >
                              {cell.day}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
