import { useCallback, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { colors, STATUS_BG } from "../../src/theme";
import { Card, EmptyHint, Muted, PrimaryButton, Screen, SectionTitle, StatusBadge } from "../../src/ui";

type Room = {
  id: string;
  code: string;
  display_status: string;
  tenant_name?: string | null;
  end_date?: string | null;
  balance_due: number;
};

export default function AdminRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setRooms(await api<Room[]>("/api/room-board"));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const todayFocus = rooms.filter((r) =>
    ["occupied", "reserved", "checkout_today", "overdue"].includes(r.display_status),
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}>
      <SectionTitle icon="grid-outline">Phòng đang hoạt động</SectionTitle>
      <Muted style={{ marginBottom: 14 }}>
        {todayFocus.length} phòng · kéo để làm mới
      </Muted>

      {todayFocus.map((r) => (
        <Card key={r.id} tint={STATUS_BG[r.display_status] || colors.surface}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{r.code}</Text>
            <StatusBadge status={r.display_status} />
          </View>
          {r.tenant_name ? (
            <Text style={{ marginTop: 8, color: colors.text, fontWeight: "500" }}>{r.tenant_name}</Text>
          ) : null}
          {r.end_date ? <Muted style={{ marginTop: 4 }}>Đến {r.end_date}</Muted> : null}
          {Number(r.balance_due) > 0 ? (
            <Text style={{ marginTop: 8, color: colors.overdue, fontWeight: "700" }}>
              Nợ: {Number(r.balance_due).toLocaleString("vi-VN")}₫
            </Text>
          ) : null}
        </Card>
      ))}

      {todayFocus.length === 0 ? <EmptyHint>Không có phòng đang hoạt động hôm nay</EmptyHint> : null}
      <PrimaryButton label="Làm mới" onPress={load} style={{ marginTop: 8 }} />
    </Screen>
  );
}
