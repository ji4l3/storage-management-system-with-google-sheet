import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

interface AutoRefreshConfig {
  enabled: boolean;
  interval: number; // milliseconds (0 = disabled)
  onAppForeground: boolean;
  onRefresh: () => void | Promise<void>;
}

/**
 * Auto-refresh hook - Plan B (App State Only)
 * - Only refreshes when app comes to foreground
 * - Saves data and battery
 * - No interval-based refresh
 */
export function useAutoRefresh(config: AutoRefreshConfig) {
  const { enabled, interval, onAppForeground, onRefresh } = config;
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshTime = useRef<number>(Date.now());

  // Setup interval-based refresh (only if interval > 0)
  useEffect(() => {
    if (!enabled || interval === 0) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      console.log("🔄 Auto-refresh: Interval triggered");
      lastRefreshTime.current = Date.now();
      onRefresh();
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, onRefresh]);

  // Setup app state listener (Plan B: Only this is active)
  useEffect(() => {
    if (!enabled || !onAppForeground) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        // App came to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime.current;

          // Only refresh if more than 10 seconds since last refresh
          // (prevents double refresh on quick app switches)
          if (timeSinceLastRefresh > 10000) {
            console.log("🔄 Auto-refresh: App came to foreground");
            lastRefreshTime.current = Date.now();
            onRefresh();
          }
        }

        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [enabled, onAppForeground, onRefresh]);
}
