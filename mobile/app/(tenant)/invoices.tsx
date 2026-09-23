import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";
import { Card, EmptyHint, Muted, PrimaryButton, Screen, SectionTitle } from "../../src/ui";

type Invoice = {
  id: string;
  invoice_no: string;
  amount: number;
  paid_amount: number;
  balance?: number;
  status: string;
  due_date: string;
  description?: string | null;
};

type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  status: string;
  pay_url?: string | null;
  qr_code?: string | null;
};

export default function TenantInvoices() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [paying, setPaying] = useState(false);
  const [active, setActive] = useState<Payment | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api<Invoice[]>("/api/invoices").then(setRows).catch(() => setRows([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  useEffect(() => {
    if (!active || active.status === "confirmed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const p = await api<Payment>(`/api/payments/${active.id}`);
        setActive(p);
        if (p.status === "confirmed") {
          if (pollRef.current) clearInterval(pollRef.current);
          load();
        }
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active, load]);

  async function startPay(inv: Invoice, method: "momo" | "vietqr") {
    setPaying(true);
    try {
      const payment = await api<Payment>("/api/payments/online", {
        method: "POST",
        body: JSON.stringify({ invoice_id: inv.id, method }),
      });
      setActive(payment);
      if (payment.pay_url) await Linking.openURL(payment.pay_url);
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không tạo được thanh toán");
    } finally {
      setPaying(false);
    }
  }

  function askMethod(inv: Invoice) {
    const balance = Number(inv.balance ?? inv.amount - inv.paid_amount);
    if (balance <= 0 || inv.status === "paid") {
      Alert.alert("Thông báo", "Hóa đơn đã thanh toán đủ");
      return;
    }
    Alert.alert("Chọn phương thức", "Thanh toán online", [
      { text: "MoMo", onPress: () => startPay(inv, "momo") },
      { text: "VietQR / Ngân hàng", onPress: () => startPay(inv, "vietqr") },
      { text: "Hủy", style: "cancel" },
    ]);
  }

  return (
    <>
      <Screen>
        <SectionTitle icon="receipt-outline">Hóa đơn</SectionTitle>
        <Muted style={{ marginBottom: 14 }}>Thanh toán online qua MoMo hoặc VietQR.</Muted>

        {rows.map((inv) => {
          const balance = Number(inv.balance ?? inv.amount - inv.paid_amount);
          return (
            <Card key={inv.id}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{inv.invoice_no}</Text>
              <Muted style={{ marginTop: 4 }}>{inv.description || inv.status}</Muted>
              <Text style={{ marginTop: 8, color: colors.text }}>
                Tổng {Number(inv.amount).toLocaleString("vi-VN")}₫ · đã trả{" "}
                {Number(inv.paid_amount).toLocaleString("vi-VN")}₫
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontWeight: "700",
                  color: balance > 0 ? colors.overdue : colors.success,
                }}
              >
                Còn lại {balance.toLocaleString("vi-VN")}₫
              </Text>
              <Muted style={{ marginTop: 4 }}>Hạn: {inv.due_date}</Muted>
              {balance > 0 ? (
                <PrimaryButton
                  label="Thanh toán online"
                  onPress={() => askMethod(inv)}
                  disabled={paying}
                  style={{ marginTop: 12 }}
                />
              ) : (
                <Text style={{ marginTop: 10, color: colors.success, fontWeight: "700" }}>Đã thanh toán</Text>
              )}
            </Card>
          );
        })}

        {rows.length === 0 ? <EmptyHint>Chưa có hóa đơn</EmptyHint> : null}
      </Screen>

      <Modal visible={!!active} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(10,61,64,0.45)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              padding: spacing.xl,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            }}
          >
            {active?.status === "confirmed" ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.success }}>Thanh toán thành công</Text>
                <Muted style={{ marginTop: 8 }}>
                  Số tiền {Number(active.amount).toLocaleString("vi-VN")}₫ đã được xác nhận.
                </Muted>
                <PrimaryButton label="Đóng" onPress={() => setActive(null)} style={{ marginTop: 16 }} />
              </>
            ) : active?.status === "failed" ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.danger }}>Thanh toán thất bại</Text>
                <PrimaryButton label="Đóng" onPress={() => setActive(null)} style={{ marginTop: 16 }} />
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Đang chờ xác nhận</Text>
                <Muted style={{ marginTop: 8 }}>
                  Hoàn tất trên cổng thanh toán. Trạng thái cập nhật tự động.
                </Muted>
                {active?.pay_url ? (
                  <PrimaryButton
                    label="Mở lại trang thanh toán"
                    variant="ghost"
                    onPress={() => Linking.openURL(active.pay_url!)}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
                <View style={{ marginTop: 16, alignItems: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
                <Pressable onPress={() => setActive(null)} style={{ marginTop: 16, padding: 8 }}>
                  <Muted style={{ textAlign: "center" }}>Ẩn</Muted>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
