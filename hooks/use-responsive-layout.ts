import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { UI_CONFIG } from "@/constants/dashboard";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const isTablet =
      Math.min(width, height) >= UI_CONFIG.responsive.tabletMinWidth;

    const columns = isTablet
      ? isLandscape
        ? UI_CONFIG.responsive.tabletLandscapeColumns
        : UI_CONFIG.responsive.tabletPortraitColumns
      : UI_CONFIG.responsive.phoneColumns;

    const itemWidth = `${100 / columns}%` as const;

    return {
      isLandscape,
      isTablet,
      columns,
      itemWidth,
      screenWidth: width,
      screenHeight: height,
    };
  }, [width, height]);
}
