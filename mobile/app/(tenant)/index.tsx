import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import { Card, EmptyHint, Muted, Screen, SectionTitle } from "../../src/ui";

type Occ = {
  id: string;
  unit_code?: string | null;
  kind: string;
  status: string;
  start_date: string;
  end_date: string;
};

export default function TenantHome() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Occ[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.tenant_id) return;
      api<Occ[]>(`/api/tenants/${user.tenant_id}/history`).then(setRows);
    }, [user?.tenant_id]),
  );

  return (
    <Screen>
      <SectionTitle icon="home-outline">Lịch sử thuê</SectionTitle>
      <Muted style={{ marginBottom: 14 }}>Các lần thuê gắn với tài khoản của bạn.</Muted>

      {rows.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>
            {o.unit_code || o.id.slice(0, 8)}
          </Text>
          <Muted style={{ marginTop: 4 }}>
            {o.kind === "contract" ? "Hợp đồng" : "Booking"} · {o.status}
          </Muted>
          <Text style={{ marginTop: 8, color: colors.text }}>
            {o.start_date} → {o.end_date}
          </Text>
        </Card>
      ))}

      {rows.length === 0 ? <EmptyHint>Chưa có dữ liệu thuê</EmptyHint> : null}
    </Screen>
  );
}
