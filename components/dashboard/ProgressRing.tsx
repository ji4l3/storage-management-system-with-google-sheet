import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { UI_CONFIG } from "@/constants/dashboard";

interface ProgressRingProps {
  percent: number;
}

export const ProgressRing = React.memo<ProgressRingProps>(({ percent }) => {
  const { size, strokeWidth } = UI_CONFIG.progressRing;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedPercent = Math.max(0, Math.min(100, percent));
  const strokeDasharray = (normalizedPercent / 100) * circumference;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="#2b2f3a"
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={UI_CONFIG.colors.accent}
          fill="none"
          strokeDasharray={`${strokeDasharray} ${circumference}`}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {normalizedPercent.toFixed(0)}%
        </Text>
        <Text
          style={{
            color: UI_CONFIG.colors.textSecondary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          COMPLETE
        </Text>
      </View>
    </View>
  );
});

ProgressRing.displayName = "ProgressRing";
