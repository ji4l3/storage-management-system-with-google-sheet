import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  user: { username: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@auth_token";
const USER_STORAGE_KEY = "@user_data";
const LAST_ACTIVE_KEY = "@last_active_time";

// Session timeout: 20 hours (in milliseconds)
const SESSION_TIMEOUT = 20 * 60 * 60 * 1000; // 20 hours

// Fixed user credentials
const validateCredentials = async (
  username: string,
  password: string,
): Promise<boolean> => {
  const demoUsername =
    process.env.EXPO_PUBLIC_DEMO_USERNAME ||
    Constants.expoConfig?.extra?.demoUsername ||
    "demo";
  const demoPassword =
    process.env.EXPO_PUBLIC_DEMO_PASSWORD ||
    Constants.expoConfig?.extra?.demoPassword ||
    "demo123";

  return username === demoUsername && password === demoPassword;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ username: string } | null>(null);

  // Check if user is logged in
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

      if (token && userData && lastActiveStr) {
        const lastActiveTime = parseInt(lastActiveStr, 10);
        const currentTime = Date.now();
        const timeDiff = currentTime - lastActiveTime;

        // Check if session has expired (over 20 hours)
        if (timeDiff > SESSION_TIMEOUT) {
          // Session expired, clear login info
          console.log("Session expired, login required");
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
          setIsAuthenticated(false);
          setUser(null);
        } else {
          // Session valid, update last active time
          await AsyncStorage.setItem(LAST_ACTIVE_KEY, currentTime.toString());
          setIsAuthenticated(true);
          setUser(JSON.parse(userData));
        }
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const isValid = await validateCredentials(username, password);

      if (isValid) {
        // Generate simple token (should be from server in production)
        const token = `token_${Date.now()}`;
        const userData = { username };
        const currentTime = Date.now();

        await AsyncStorage.setItem(AUTH_STORAGE_KEY, token);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem(LAST_ACTIVE_KEY, currentTime.toString());

        setIsAuthenticated(true);
        setUser(userData);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, signIn, signOut, user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
