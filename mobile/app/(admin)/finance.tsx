import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { colors } from "../../src/theme";
import { Card, EmptyHint, Field, Muted, PrimaryButton, Screen, SectionTitle } from "../../src/ui";

type Invoice = {
  id: string;
  invoice_no: string;
  tenant_name?: string | null;
  amount: number;
  paid_amount: number;
  balance?: number;
  status: string;
};

export default function AdminFinance() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const all = await api<Invoice[]>("/api/invoices");
    setInvoices(all.filter((i) => i.status !== "paid" && i.status !== "cancelled"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function collect(id: string) {
    const amount = Number(amounts[id] || 0);
    if (!amount) {
      Alert.alert("Nhập số tiền");
      return;
    }
    try {
      await api("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoice_id: id, amount, method: "cash" }),
      });
      Alert.alert("Đã thu tiền");
      setAmounts((a) => ({ ...a, [id]: "" }));
      load();
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thu được");
    }
  }

  return (
    <Screen>
      <SectionTitle icon="cash-outline">Hóa đơn chưa thanh toán</SectionTitle>
      <Muted style={{ marginBottom: 14 }}>Thu tiền mặt trong phạm vi căn được giao.</Muted>

      {invoices.map((inv) => {
        const balance = Number(inv.balance ?? inv.amount - inv.paid_amount);
        return (
          <Card key={inv.id}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{inv.invoice_no}</Text>
            <Muted style={{ marginTop: 4 }}>{inv.tenant_name || "—"}</Muted>
            <Text style={{ marginTop: 8, color: colors.overdue, fontWeight: "700" }}>
              Còn nợ: {balance.toLocaleString("vi-VN")}₫
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
              <Field
                keyboardType="numeric"
                placeholder="Số tiền"
                value={amounts[inv.id] || ""}
                onChangeText={(t) => setAmounts({ ...amounts, [inv.id]: t })}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <PrimaryButton
                label="Thu"
                onPress={() => collect(inv.id)}
                variant="accent"
                style={{ paddingHorizontal: 18, minWidth: 72 }}
              />
            </View>
          </Card>
        );
      })}

      {invoices.length === 0 ? <EmptyHint>Không còn hóa đơn nợ</EmptyHint> : null}
    </Screen>
  );
}
