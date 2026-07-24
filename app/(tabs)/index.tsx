import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    RefreshControl,
    SafeAreaView,
    SectionList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { BuswayButton } from "@/components/dashboard/BuswayButton";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { Tab } from "@/components/dashboard/Tab";
import { UI_CONFIG } from "@/constants/dashboard";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import type { ItemView, SectionType } from "@/types/dashboard";
import {
    chunkArray,
    cleanStockCode,
    isCompletedRemark,
} from "@/utils/dashboard";

const FIREWORK_PARTICLES = 40;

export default function DashboardScreen() {
  const {
    loading,
    refreshing,
    items,
    busyMap,
    pendingByKey,
    pendingSyncCount,
    isOffline,
    refresh,
    toggleItem,
  } = useDashboardData();
  const { columns, itemWidth } = useResponsiveLayout();
  const { signOut, user } = useAuth();

  const [activeProject, setActiveProject] = useState<string>("");
  const [activeLot, setActiveLot] = useState<string>("");
  const [showFireworks, setShowFireworks] = useState(false);
  const fireworksProgress = useRef(new Animated.Value(0)).current;
  const celebratedProjectsRef = useRef<Set<string>>(new Set());

  // Extract projects from data
  const projects = useMemo(() => {
    const projectSet = new Set<string>();
    for (const item of items) {
      projectSet.add(item.projectNorm);
    }
    return [...projectSet].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [items]);

  const hasProjectTabs =
    projects.length > 1 || (projects.length === 1 && projects[0] !== "Default");

  // Ensure activeProject is valid
  useEffect(() => {
    if (!projects.length) return;
    if (!activeProject || !projects.includes(activeProject)) {
      setActiveProject(projects[0]);
    }
  }, [projects, activeProject]);

  // Filter items by active project
  const projectItems = useMemo(() => {
    if (!activeProject) return items;
    return items.filter((item) => item.projectNorm === activeProject);
  }, [items, activeProject]);

  // Extract lots from project items
  const lots = useMemo(() => {
    const lotSet = new Set<string>();
    for (const item of projectItems) {
      lotSet.add(item.lotNorm);
    }

    return [...lotSet].sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [projectItems]);

  // Ensure activeLot is valid
  useEffect(() => {
    if (!lots.length) return;
    if (!activeLot || !lots.includes(activeLot)) {
      setActiveLot(lots[0]);
    }
  }, [lots, activeLot]);

  // Filter items by active lot
  const filteredItems = useMemo(() => {
    return projectItems.filter(
      (item) => item.lotNorm === activeLot && !!item.buswayTrim,
    );
  }, [projectItems, activeLot]);

  // Calculate statistics
  const stats = useDashboardStats(projectItems, lots);

  useEffect(() => {
    if (!activeProject || !projectItems.length) return;

    const allDone = projectItems.every((item) => isCompletedRemark(item.remarks));
    if (!allDone) {
      celebratedProjectsRef.current.delete(activeProject);
      return;
    }

    if (celebratedProjectsRef.current.has(activeProject)) return;
    celebratedProjectsRef.current.add(activeProject);

    setShowFireworks(true);
    fireworksProgress.setValue(0);

    Animated.timing(fireworksProgress, {
      toValue: 1,
      duration: 5000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowFireworks(false);
    });
  }, [activeProject, projectItems, fireworksProgress]);

  // Group items into sections
  const sections: SectionType[] = useMemo(() => {
    const stockCodeMap = new Map<string, ItemView[]>();

    for (const item of filteredItems) {
      const stockCode = item.stockCodeNorm || "NO STOCK CODE";
      if (!stockCodeMap.has(stockCode)) {
        stockCodeMap.set(stockCode, []);
      }
      stockCodeMap.get(stockCode)!.push(item);
    }

    // Sort items within each stock code group
    for (const itemGroup of stockCodeMap.values()) {
      itemGroup.sort((a, b) =>
        a.buswayTrim.localeCompare(b.buswayTrim, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    }

    // Sort stock code groups
    const sortedGroups = [...stockCodeMap.entries()].sort(([a], [b]) => {
      const aCode = cleanStockCode(a);
      const bCode = cleanStockCode(b);

      if (aCode === "NO STOCK CODE") return 1;
      if (bCode === "NO STOCK CODE") return -1;

      if (aCode.length !== bCode.length) {
        return aCode.length - bCode.length;
      }

      return aCode.localeCompare(bCode, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return sortedGroups.map(([title, itemGroup]) => ({
      title,
      data: chunkArray(itemGroup, columns),
    }));
  }, [filteredItems, columns]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: UI_CONFIG.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={UI_CONFIG.colors.accent} />
        <Text
          style={{
            color: UI_CONFIG.colors.textSecondary,
            marginTop: 16,
            fontSize: 16,
          }}
        >
          Loading dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: UI_CONFIG.colors.background,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          Production Dashboard
        </Text>
        <TouchableOpacity
          onPress={signOut}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: UI_CONFIG.colors.textPrimary, fontSize: 14 }}>
            Logout ({user?.username})
          </Text>
        </TouchableOpacity>
      </View>

      {showFireworks && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 99,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Array.from({ length: FIREWORK_PARTICLES }).map((_, index) => {
            const angle = (Math.PI * 2 * index) / FIREWORK_PARTICLES;
            const distance = 120 + (index % 6) * 35;
            const driftX = Math.cos(angle) * distance;
            const driftY = Math.sin(angle) * distance;

            return (
              <Animated.View
                key={`firework-${index}`}
                style={{
                  position: "absolute",
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor:
                    index % 3 === 0
                      ? "#ffd166"
                      : index % 3 === 1
                        ? "#39d98a"
                        : "#4cc9f0",
                  transform: [
                    {
                      translateX: fireworksProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, driftX],
                      }),
                    },
                    {
                      translateY: fireworksProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, driftY],
                      }),
                    },
                    {
                      scale: fireworksProgress.interpolate({
                        inputRange: [0, 0.12, 0.8, 1],
                        outputRange: [0.15, 1.25, 1, 0.7],
                      }),
                    },
                  ],
                  opacity: fireworksProgress.interpolate({
                    inputRange: [0, 0.88, 1],
                    outputRange: [1, 1, 0],
                  }),
                }}
              />
            );
          })}
          <Animated.Text
            style={{
              marginTop: 230,
              fontSize: 22,
              fontWeight: "900",
              color: "#ffd166",
              letterSpacing: 1.4,
              opacity: fireworksProgress.interpolate({
                inputRange: [0, 0.12, 0.9, 1],
                outputRange: [0, 1, 1, 0],
              }),
            }}
          >
            PROJECT COMPLETED
          </Animated.Text>
        </View>
      )}

      {/* Summary Cards */}
      <View style={{ flexDirection: "row", marginTop: 16 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: UI_CONFIG.colors.cardBackground,
            borderRadius: 14,
            padding: 14,
            marginRight: 12,
          }}
        >
          <Text
            style={{
              color: UI_CONFIG.colors.textSecondary,
              marginBottom: 10,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            OVERALL EFFICIENCY
          </Text>
          <ProgressRing percent={stats.completionPercent} />
        </View>

        <SummaryCard stats={stats} lots={lots} />
      </View>

      {/* Project Tabs */}
      {hasProjectTabs && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
          {projects.map((project) => (
            <Tab
              key={project}
              label={project}
              active={project === activeProject}
              onPress={() => {
                setActiveProject(project);
                setActiveLot(""); // Reset lot selection
              }}
            />
          ))}
        </View>
      )}

      {/* Lot Tabs */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
        {lots.map((lot) => (
          <Tab
            key={lot}
            label={lot}
            active={lot === activeLot}
            onPress={() => setActiveLot(lot)}
          />
        ))}
      </View>

      {(isOffline || pendingSyncCount > 0) && (
        <View
          style={{
            marginTop: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isOffline
              ? "rgba(255,157,47,0.85)"
              : "rgba(255,157,47,0.45)",
            backgroundColor: isOffline
              ? "rgba(255,157,47,0.18)"
              : "rgba(255,157,47,0.12)",
          }}
        >
          <Text
            style={{
              color: UI_CONFIG.colors.textPrimary,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {isOffline
              ? `Offline mode. ${pendingSyncCount} pending item(s).`
              : `${pendingSyncCount} pending item(s). Tap orange cards to sync.`}
          </Text>
        </View>
      )}

      {/* Tasks Section */}
      <View style={{ marginTop: 14, flex: 1 }}>
        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontSize: 16,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          {(activeLot || "—") + " — Tasks"}
        </Text>

        <SectionList
          sections={sections}
          stickySectionHeadersEnabled
          keyExtractor={(row, index) =>
            `${row.map((item) => item.key).join("|")}-${index}`
          }
          renderSectionHeader={({ section }) => {
            const sectionAllDone = section.data.every((row) =>
              row.every((item) => isCompletedRemark(item.remarks)),
            );

            return (
            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: sectionAllDone ? "#1f8f58" : "#7a1220",
                borderWidth: 1,
                borderColor: sectionAllDone
                  ? "#39d98a"
                  : "#be3042",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  color: UI_CONFIG.colors.textPrimary,
                  fontWeight: "900",
                  fontSize: 15,
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {cleanStockCode(section.title)}
              </Text>
            </View>
            );
          }}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {row.map((item) => (
                <View key={item.key} style={{ width: itemWidth }}>
                  <BuswayButton
                    buswayTitle={item.buswayTrim || "—"}
                    description={item.descTrim || "—"}
                    done={isCompletedRemark(item.remarks)}
                    pending={pendingByKey.has(item.key)}
                    pendingTarget={pendingByKey.get(item.key)}
                    busy={!!busyMap[item.key]}
                    onPress={() => toggleItem(item)}
                  />
                </View>
              ))}

              {/* Fill remaining columns with empty space */}
              {row.length < columns &&
                Array.from({ length: columns - row.length }).map((_, index) => (
                  <View key={`spacer-${index}`} style={{ width: itemWidth }} />
                ))}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={UI_CONFIG.colors.accent}
            />
          }
          ListEmptyComponent={<View />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </SafeAreaView>
  );
}
