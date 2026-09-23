import type { ComponentProps, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "./theme";

export type IconName = keyof typeof Ionicons.glyphMap;

export function ModuleIcon({
  name,
  size = 22,
  color = colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function BrandMark({ light = false, size = "md" }: { light?: boolean; size?: "sm" | "md" | "lg" }) {
  const eyebrow = size === "sm" ? 9 : size === "lg" ? 11 : 10;
  const title = size === "sm" ? 18 : size === "lg" ? 28 : 22;
  return (
    <View>
      <Text
        style={{
          fontSize: eyebrow,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: light ? "rgba(255,255,255,0.65)" : colors.muted,
          fontWeight: "600",
        }}
      >
        Harbor Stay
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: title,
          fontWeight: "700",
          color: light ? colors.white : colors.bgDeep,
          letterSpacing: -0.4,
        }}
      >
        Rental PMS
      </Text>
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>["refreshControl"];
}) {
  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }, contentStyle]}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <View style={[{ flex: 1, padding: spacing.lg, backgroundColor: colors.bg }, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: tint || colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.lg - 2,
          marginBottom: spacing.md,
          shadowColor: colors.bgDeep,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  children,
  icon,
}: {
  children: string;
  icon?: IconName;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
      {icon ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModuleIcon name={icon} size={18} color={colors.primaryDeep} />
        </View>
      ) : null}
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.3 }}>{children}</Text>
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: colors.muted, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>;
}

export function EmptyHint({ children }: { children: string }) {
  return (
    <View
      style={{
        padding: spacing.xl,
        alignItems: "center",
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        backgroundColor: colors.surfaceSoft,
      }}
    >
      <Text style={{ color: colors.muted, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  style,
}: {
  label: string;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  variant?: "primary" | "accent" | "ghost" | "dark";
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === "accent"
      ? colors.accent
      : variant === "ghost"
        ? "transparent"
        : variant === "dark"
          ? colors.bgDeep
          : colors.primary;
  const color = variant === "ghost" ? colors.primary : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: bg,
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderRadius: radius.sm,
          opacity: disabled ? 0.55 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.primary,
        },
        style,
      ]}
    >
      <Text style={{ color, textAlign: "center", fontWeight: "700", letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 12,
          color: colors.text,
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const bg = STATUS_BG_LOCAL[status] || colors.surfaceSoft;
  const fg = STATUS_FG_LOCAL[status] || colors.muted;
  const label = STATUS_LABEL_LOCAL[status] || status;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.full,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

const STATUS_LABEL_LOCAL: Record<string, string> = {
  vacant: "Trống",
  reserved: "Đã đặt",
  occupied: "Đang thuê",
  checkout_today: "Trả hôm nay",
  maintenance: "Bảo trì",
  overdue: "Quá hạn",
};

const STATUS_BG_LOCAL: Record<string, string> = {
  vacant: "#d8f3e8",
  reserved: "#f7efc8",
  occupied: "#dce8f0",
  checkout_today: "#fde8d0",
  maintenance: "#e8eef0",
  overdue: "#f8d9d9",
};

const STATUS_FG_LOCAL: Record<string, string> = {
  vacant: colors.vacant,
  reserved: colors.reserved,
  occupied: colors.occupied,
  checkout_today: colors.checkout,
  maintenance: colors.maintenance,
  overdue: colors.overdue,
};

export function HeaderTitle({ title, icon }: { title: string; icon: IconName }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <ModuleIcon name={icon} size={18} color={colors.white} />
      <Text style={{ color: colors.white, fontWeight: "700", fontSize: 17 }}>{title}</Text>
    </View>
  );
}
