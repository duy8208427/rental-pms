import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth";
import { FeedbackSection } from "../../src/FeedbackSection";
import { colors, radius, spacing } from "../../src/theme";
import { BrandMark, Card, Muted, PrimaryButton, Screen } from "../../src/ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị",
  manager: "Người quản lý",
  tenant: "Khách thuê",
};

export default function AdminProfile() {
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
            backgroundColor: colors.primarySoft,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.full,
          }}
        >
          <Text style={{ color: colors.primaryDeep, fontWeight: "700", fontSize: 12 }}>
            {ROLE_LABEL[user?.role ?? ""] ?? user?.role}
          </Text>
        </View>
        {user?.role === "manager" ? (
          <Text style={{ marginTop: spacing.md, color: colors.primary, fontWeight: "600" }}>
            Phụ trách: {user.managed_property_name ?? "—"}
          </Text>
        ) : null}
      </Card>
      {user?.role === "manager" ? <FeedbackSection /> : null}
      <PrimaryButton
        label="Đăng xuất"
        variant="dark"
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}
