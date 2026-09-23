import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../src/auth";
import { colors, radius, spacing } from "../src/theme";
import { BrandMark, Field, PrimaryButton } from "../src/ui";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Redirect href={user.role === "tenant" ? "/(tenant)" : "/(admin)"} />;
  }

  async function onLogin() {
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <View
        style={{
          paddingTop: 64,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
        }}
      >
        <BrandMark light size="lg" />
        <Text style={{ marginTop: spacing.md, color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 22 }}>
          Vận hành tại chỗ cho người quản lý và cổng khách thuê.
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          padding: spacing.xl,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.3 }}>
          Đăng nhập
        </Text>
        <Text style={{ marginTop: 4, marginBottom: spacing.lg, color: colors.muted, fontSize: 13 }}>
          Dùng tài khoản được cấp — manager chỉ trên mobile.
        </Text>

        <Field
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          style={{ marginBottom: spacing.md }}
        />
        <Field
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mật khẩu"
          style={{ marginBottom: spacing.lg }}
        />
        <PrimaryButton label={busy ? "Đang đăng nhập…" : "Đăng nhập"} onPress={onLogin} disabled={busy} />

        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.md,
            borderRadius: radius.sm,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primaryDeep, letterSpacing: 1 }}>
            DEMO
          </Text>
          <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            admin@example.com / admin123{"\n"}
            manager.hotel@example.com / manager123{"\n"}
            tenant@example.com / tenant123
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
