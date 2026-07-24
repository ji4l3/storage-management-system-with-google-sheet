import React from "react";
import { Text, View } from "react-native";

import { UI_CONFIG } from "@/constants/dashboard";
import type { DashboardStats } from "@/types/dashboard";

interface SummaryCardProps {
  stats: DashboardStats;
  lots: string[];
}

export const SummaryCard = React.memo<SummaryCardProps>(({ stats, lots }) => {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: UI_CONFIG.colors.cardBackground,
        borderRadius: 14,
        padding: 14,
        justifyContent: "space-between",
      }}
    >
      <View>
        <Text
          style={{
            color: UI_CONFIG.colors.textSecondary,
            marginBottom: 10,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          SUMMARY
        </Text>

        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          Done: {stats.completedItems}
        </Text>
        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            marginTop: 6,
          }}
        >
          Total: {stats.totalItems}
        </Text>

        {/* Per-lot statistics */}
        <View style={{ marginTop: 12 }}>
          {lots
            .filter((lot) => lot !== "Unknown")
            .map((lot) => {
              const lotStat = stats.lotStats[lot];
              if (!lotStat || lotStat.total === 0) return null;

              return (
                <View
                  key={lot}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      color: UI_CONFIG.colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {lot}
                  </Text>
                  <Text
                    style={{
                      color: UI_CONFIG.colors.textPrimary,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {lotStat.done}/{lotStat.total}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>
    </View>
  );
});

SummaryCard.displayName = "SummaryCard";
