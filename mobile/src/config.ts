import Constants from "expo-constants";
import { Platform } from "react-native";

/** Android emulator → host machine localhost */
const host =
  Platform.OS === "android"
    ? "10.0.2.2"
    : Constants.expoConfig?.hostUri?.split(":")[0] || "127.0.0.1";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || `http://${host}:8000`;
