import Constants from "expo-constants";

export const API_CONFIG = {
  baseUrl:
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    "",
  token:
    process.env.EXPO_PUBLIC_API_TOKEN ||
    Constants.expoConfig?.extra?.apiToken ||
    "",
  timeout: 30000, // ✅ 增加到 30 秒
  retryAttempts: 3,
} as const;

export const CACHE_CONFIG = {
  key: "dashboard.cacheItems.v3",
  saveDelay: 250,
} as const;

export const OFFLINE_QUEUE_CONFIG = {
  key: "dashboard.offlineQueue.v1",
} as const;

export const SHEET_STATUS = {
  COMPLETED: "Completed",
  TO_RUN: "To run",
} as const;

export const UI_CONFIG = {
  progressRing: {
    size: 120,
    strokeWidth: 12,
  },
  responsive: {
    tabletMinWidth: 768,
    phoneColumns: 4,
    tabletPortraitColumns: 4,
    tabletLandscapeColumns: 6,
  },
  colors: {
    background: "#0b0f1a",
    cardBackground: "#12182a",
    accent: "#39d98a",
    pending: "#ff9d2f",
    textPrimary: "#ffffff",
    textSecondary: "#aab2c0",
    border: "rgba(255,255,255,0.14)",
  },
  autoRefresh: {
    enabled: true,
    interval: 0, // Disabled - no interval refresh
    onAppForeground: true, // Only refresh when app comes to foreground
  },
} as const;
