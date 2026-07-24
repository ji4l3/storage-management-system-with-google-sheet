import { useMemo } from "react";

import type { DashboardStats, ItemView } from "@/types/dashboard";
import { isCompletedRemark } from "@/utils/dashboard";

export function useDashboardStats(
  projectItems: ItemView[],
  lots: string[],
): DashboardStats {
  return useMemo(() => {
    const totalItems = projectItems.length;
    const completedItems = projectItems.filter((item) =>
      isCompletedRemark(item.remarks),
    ).length;

    const completionPercent =
      totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    // Calculate per-lot statistics
    const lotStats: Record<string, { done: number; total: number }> = {};

    // Initialize all lots
    for (const lot of lots) {
      lotStats[lot] = { done: 0, total: 0 };
    }

    // Count items per lot
    for (const item of projectItems) {
      const lot = item.lotNorm;
      if (!lotStats[lot]) {
        lotStats[lot] = { done: 0, total: 0 };
      }

      lotStats[lot].total += 1;
      if (isCompletedRemark(item.remarks)) {
        lotStats[lot].done += 1;
      }
    }

    return {
      totalItems,
      completedItems,
      completionPercent,
      lotStats,
    };
  }, [projectItems, lots]);
}
