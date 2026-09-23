export const colors = {
  bg: "#eef6f5",
  bgDeep: "#0a3d40",
  surface: "#ffffff",
  surfaceSoft: "#f3faf9",
  text: "#12262a",
  muted: "#5a7378",
  border: "#cfe3e1",
  primary: "#0d7377",
  primaryDeep: "#095456",
  primarySoft: "#d4efef",
  accent: "#e8a87c",
  accentDeep: "#c9784a",
  vacant: "#1a9b6c",
  occupied: "#3d6b8c",
  reserved: "#c9a227",
  checkout: "#d97706",
  overdue: "#c23b3b",
  maintenance: "#6b7c85",
  white: "#ffffff",
  danger: "#c23b3b",
  success: "#1a9b6c",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
} as const;

export const STATUS_LABEL: Record<string, string> = {
  vacant: "Trống",
  reserved: "Đã đặt",
  occupied: "Đang thuê",
  checkout_today: "Trả hôm nay",
  maintenance: "Bảo trì",
  overdue: "Quá hạn",
};

export const STATUS_BG: Record<string, string> = {
  vacant: "#d8f3e8",
  reserved: "#f7efc8",
  occupied: "#dce8f0",
  checkout_today: "#fde8d0",
  maintenance: "#e8eef0",
  overdue: "#f8d9d9",
};

export const STATUS_FG: Record<string, string> = {
  vacant: colors.vacant,
  reserved: colors.reserved,
  occupied: colors.occupied,
  checkout_today: colors.checkout,
  maintenance: colors.maintenance,
  overdue: colors.overdue,
};
