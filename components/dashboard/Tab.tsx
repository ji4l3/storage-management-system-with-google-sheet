import React from "react";
import { Pressable, Text } from "react-native";

import { UI_CONFIG } from "@/constants/dashboard";

interface TabProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export const Tab = React.memo<TabProps>(({ label, active, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active
          ? UI_CONFIG.colors.accent
          : UI_CONFIG.colors.cardBackground,
        borderWidth: 1,
        borderColor: active
          ? UI_CONFIG.colors.accent
          : "rgba(255,255,255,0.08)",
        marginRight: 10,
        marginBottom: 10,
      }}
      accessible={true}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} tab`}
    >
      <Text
        style={{
          color: active
            ? UI_CONFIG.colors.background
            : UI_CONFIG.colors.textPrimary,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

Tab.displayName = "Tab";
