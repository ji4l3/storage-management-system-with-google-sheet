import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import Constants from "expo-constants";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Alert, Linking } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { DashboardAPI } from "@/services/api";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const updateCheckedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && inAuthGroup) {
      // Not authenticated but trying to access protected page, redirect to login
      router.replace("/login");
    } else if (isAuthenticated && !inAuthGroup) {
      // Authenticated but on login page, redirect to home
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading, router]);

  useEffect(() => {
    if (updateCheckedRef.current) return;
    updateCheckedRef.current = true;

    const checkUpdate = async () => {
      try {
        const response = await DashboardAPI.fetchAppConfig();
        if (!response.ok) return;

        const apkUrl = String(response.apkUrl || "").trim();
        if (!apkUrl) return;

        const localVersionCode = Number(
          Constants.expoConfig?.android?.versionCode || 0,
        );
        const localVersion = String(Constants.expoConfig?.version || "");
        const latestCode = Number(response.latestVersionCode || 0);
        const minCode = Number(response.minSupportedVersionCode || 0);
        const forceUpdate = Boolean(response.forceUpdate);
        const latestVersion = String(response.latestVersion || "");

        const hasVersionCodeUpdate =
          localVersionCode > 0 && latestCode > localVersionCode;
        const hasVersionNameUpdate = !!latestVersion && latestVersion !== localVersion;
        const requiresForce = minCode > 0 && localVersionCode > 0 && localVersionCode < minCode;
        const shouldUpdate = forceUpdate || requiresForce || hasVersionCodeUpdate || hasVersionNameUpdate;

        if (!shouldUpdate) return;

        const messageLines = [
          latestVersion ? `Latest: v${latestVersion}` : "New version available.",
          response.changelog ? `\n${response.changelog}` : "",
        ].filter(Boolean);

        const openDownload = () => {
          Linking.openURL(apkUrl).catch(() => {
            Alert.alert("Update Error", "Unable to open update link.");
          });
        };

        if (forceUpdate || requiresForce) {
          Alert.alert("Update Required", messageLines.join("\n"), [
            { text: "Update Now", onPress: openDownload },
          ]);
          return;
        }

        Alert.alert("Update Available", messageLines.join("\n"), [
          { text: "Later", style: "cancel" },
          { text: "Update", onPress: openDownload },
        ]);
      } catch (error) {
        console.warn("Update check failed:", error);
      }
    };

    checkUpdate();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
