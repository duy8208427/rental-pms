import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth";
import { FeedbackSection } from "../../src/FeedbackSection";
import { colors, radius, spacing } from "../../src/theme";
import { BrandMark, Card, Muted, PrimaryButton, Screen } from "../../src/ui";

export default function TenantProfile() {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <BrandMark size="md" />
      <Card style={{ marginTop: spacing.xl }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.primaryDeep }}>
            {(user?.full_name || "?").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{user?.full_name}</Text>
        <Muted style={{ marginTop: 4 }}>{user?.email}</Muted>
        <View
          style={{
            marginTop: spacing.md,
            alignSelf: "flex-start",
            backgroundColor: colors.accent + "33",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.full,
          }}
        >
          <Text style={{ color: colors.accentDeep, fontWeight: "700", fontSize: 12 }}>Khách thuê</Text>
        </View>
      </Card>
      <FeedbackSection />
      <PrimaryButton
        label="Đăng xuất"
        variant="dark"
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
        style={{ marginTop: spacing.md }}
      />
      <Muted style={{ textAlign: "center", marginTop: spacing.md }}>Harbor Stay · portal khách thuê</Muted>
    </Screen>
  );
}
