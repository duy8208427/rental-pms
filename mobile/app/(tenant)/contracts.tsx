import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { colors } from "../../src/theme";
import { Card, EmptyHint, Muted, Screen, SectionTitle } from "../../src/ui";

type Contract = {
  id: string;
  contract_no: string;
  deposit: number;
  monthly_rent: number;
  billing_cycle: string;
  unit_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

export default function TenantContracts() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      api<Contract[]>("/api/contracts")
        .then(setRows)
        .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải hợp đồng"));
    }, []),
  );

  return (
    <Screen>
      <SectionTitle icon="document-text-outline">Hợp đồng của bạn</SectionTitle>
      {error ? (
        <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>
      ) : null}

      {rows.map((c) => (
        <Card key={c.id}>
          <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{c.contract_no}</Text>
          <Muted style={{ marginTop: 4 }}>
            {c.unit_code || "—"} · {c.status || "—"}
          </Muted>
          <Text style={{ marginTop: 8, color: colors.text }}>
            Thuê: {Number(c.monthly_rent).toLocaleString("vi-VN")}₫ /{" "}
            {c.billing_cycle === "monthly" ? "tháng" : c.billing_cycle}
          </Text>
          <Text style={{ marginTop: 4, color: colors.text }}>
            Đặt cọc: {Number(c.deposit).toLocaleString("vi-VN")}₫
          </Text>
          <Muted style={{ marginTop: 6 }}>
            {c.start_date || "?"} → {c.end_date || "?"}
          </Muted>
        </Card>
      ))}

      {rows.length === 0 && !error ? <EmptyHint>Chưa có hợp đồng</EmptyHint> : null}
    </Screen>
  );
}
