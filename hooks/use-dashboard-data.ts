import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import {
  CACHE_CONFIG,
  OFFLINE_QUEUE_CONFIG,
  SHEET_STATUS,
} from "@/constants/dashboard";
import { DashboardAPI, DashboardAPIError } from "@/services/api";
import type {
  BatchUpdateItem,
  Item,
  ItemView,
  PendingStatus,
  UpdateBatchRemarksPayload,
  UpdateRemarksPayload,
} from "@/types/dashboard";
import {
  isValidItem,
  keyOf,
  splitBuswayNo,
  transformItemsToView,
} from "@/utils/dashboard";

function statusFromRemarks(remarks?: string): PendingStatus {
  return String(remarks ?? "")
    .trim()
    .toLowerCase() === "completed"
    ? "done"
    : "undone";
}

function remarksFromStatus(status: PendingStatus): "Completed" | "To run" {
  return status === "done" ? SHEET_STATUS.COMPLETED : SHEET_STATUS.TO_RUN;
}

function isNetworkLikeFailure(error: unknown): boolean {
  return (
    error instanceof DashboardAPIError &&
    (!error.statusCode || error.statusCode >= 500)
  );
}

function isSameItem(
  source: Pick<Item, "spreadsheetId" | "sheetName" | "rowNumber">,
  target: Pick<Item, "spreadsheetId" | "sheetName" | "rowNumber">,
): boolean {
  return (
    source.spreadsheetId === target.spreadsheetId &&
    source.sheetName === target.sheetName &&
    source.rowNumber === target.rowNumber
  );
}

function isValidQueueItem(item: unknown): item is BatchUpdateItem {
  if (!item || typeof item !== "object") return false;
  const row = item as BatchUpdateItem;
  return (
    typeof row.key === "string" &&
    typeof row.spreadsheetId === "string" &&
    typeof row.sheetName === "string" &&
    typeof row.buswayPrefix === "string" &&
    typeof row.sequenceNumber === "number" &&
    (row.status === "done" || row.status === "undone") &&
    typeof row.clientTimestamp === "number"
  );
}

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheItems, setCacheItems] = useState<Item[]>([]);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [offlineQueue, setOfflineQueue] = useState<BatchUpdateItem[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const aliveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offlineNow = !state.isConnected || state.isInternetReachable === false;
      setIsOffline(offlineNow);
    });

    NetInfo.fetch().then((state) => {
      const offlineNow = !state.isConnected || state.isInternetReachable === false;
      setIsOffline(offlineNow);
    });

    return unsubscribe;
  }, []);

  // Restore cache and offline queue on mount.
  useEffect(() => {
    const restoreLocalState = async () => {
      try {
        const [cacheStr, queueStr] = await Promise.all([
          AsyncStorage.getItem(CACHE_CONFIG.key),
          AsyncStorage.getItem(OFFLINE_QUEUE_CONFIG.key),
        ]);

        if (cacheStr) {
          const parsedCache = JSON.parse(cacheStr);
          if (Array.isArray(parsedCache)) {
            const validItems = parsedCache.filter(isValidItem);
            if (aliveRef.current) {
              setCacheItems(validItems);
            }
          }
        }

        if (queueStr) {
          const parsedQueue = JSON.parse(queueStr);
          if (Array.isArray(parsedQueue)) {
            const validQueue = parsedQueue.filter(isValidQueueItem);
            if (aliveRef.current) {
              setOfflineQueue(validQueue);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to restore local state:", error);
      }
    };

    restoreLocalState();
  }, []);

  // Save cache with debouncing.
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(CACHE_CONFIG.key, JSON.stringify(cacheItems)).catch(
        (error) => console.warn("Failed to save cache:", error),
      );
    }, CACHE_CONFIG.saveDelay);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [cacheItems]);

  useEffect(() => {
    AsyncStorage.setItem(OFFLINE_QUEUE_CONFIG.key, JSON.stringify(offlineQueue)).catch(
      (error) => console.warn("Failed to save offline queue:", error),
    );
  }, [offlineQueue]);

  const loadData = useCallback(async () => {
    try {
      const response = await DashboardAPI.fetchItems();

      if (!response.ok) {
        Alert.alert("API Error", response.error || "Unknown error occurred");
        return;
      }

      const validItems = (response.items || []).filter(isValidItem);
      if (aliveRef.current) {
        setCacheItems(validItems);
      }
    } catch (error) {
      const message =
        error instanceof DashboardAPIError
          ? error.message
          : "Network error occurred. Please check your connection.";

      Alert.alert("Error", message);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    const initialLoad = async () => {
      try {
        await loadData();
      } finally {
        if (aliveRef.current) {
          setLoading(false);
        }
      }
    };

    initialLoad();
  }, [loadData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const pendingByKey = useMemo(() => {
    const map = new Map<string, PendingStatus>();
    for (const row of offlineQueue) {
      map.set(row.key, row.status);
    }
    return map;
  }, [offlineQueue]);

  const pendingSyncCount = offlineQueue.length;

  const enqueueUpdate = useCallback((entry: BatchUpdateItem) => {
    setOfflineQueue((prev) => {
      const deduped = prev.filter((row) => row.key !== entry.key);
      return [...deduped, entry];
    });
  }, []);

  const dequeueUpdateByKey = useCallback((key: string) => {
    setOfflineQueue((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const buildQueueItem = useCallback(
    (item: ItemView, status: PendingStatus): BatchUpdateItem => {
      const split = splitBuswayNo(item.buswayNo);
      const sequenceStr = split.numbers.match(/\d+/)?.[0] ?? "";
      const sequenceNumber = Number.parseInt(sequenceStr, 10);

      return {
        key: item.key,
        spreadsheetId: item.spreadsheetId || "unknown",
        sheetName: item.sheetName,
        buswayPrefix: split.letters,
        sequenceNumber: Number.isNaN(sequenceNumber)
          ? item.rowNumber
          : sequenceNumber,
        rowNumber: item.rowNumber,
        status,
        clientTimestamp: Date.now(),
      };
    },
    [],
  );

  const buildQueueItemFromItem = useCallback(
    (item: Item, status: PendingStatus): BatchUpdateItem => {
      const split = splitBuswayNo(item.buswayNo || "");
      const sequenceStr = split.numbers.match(/\d+/)?.[0] ?? "";
      const sequenceNumber = Number.parseInt(sequenceStr, 10);

      return {
        key: keyOf(item),
        spreadsheetId: item.spreadsheetId || "unknown",
        sheetName: item.sheetName,
        buswayPrefix: split.letters,
        sequenceNumber: Number.isNaN(sequenceNumber)
          ? item.rowNumber
          : sequenceNumber,
        rowNumber: item.rowNumber,
        status,
        clientTimestamp: Date.now(),
      };
    },
    [],
  );

  const toggleItem = useCallback(
    async (item: ItemView) => {
      const key = item.key;
      if (busyMap[key]) return;

      if (item.isQuantityAggregate) {
        const rowNumbers = (item.aggregateRowNumbers || [])
          .filter((row) => Number.isFinite(row) && row >= 2)
          .map((row) => Number(row));

        if (!rowNumbers.length) return;
        if (isOffline) {
          Alert.alert("Offline", "Summary item can only be updated while online.");
          return;
        }

        const groupRows = new Set(rowNumbers);
        const relatedItems = cacheItems.filter(
          (x) =>
            x.spreadsheetId === item.spreadsheetId &&
            x.sheetName === item.sheetName &&
            groupRows.has(x.rowNumber),
        );

        if (!relatedItems.length) return;

        const allDone = relatedItems.every((x) => statusFromRemarks(x.remarks) === "done");
        const targetRemarks = allDone ? SHEET_STATUS.TO_RUN : SHEET_STATUS.COMPLETED;
        const rollbackMap = new Map<number, string | undefined>();
        for (const row of relatedItems) {
          rollbackMap.set(row.rowNumber, row.remarks);
        }

        setBusyMap((prev) => ({ ...prev, [key]: true }));
        setCacheItems((prev) =>
          prev.map((x) =>
            x.spreadsheetId === item.spreadsheetId &&
            x.sheetName === item.sheetName &&
            groupRows.has(x.rowNumber)
              ? { ...x, remarks: targetRemarks }
              : x,
          ),
        );

        try {
          const payload: UpdateBatchRemarksPayload = {
            spreadsheetId: item.spreadsheetId,
            sheetName: item.sheetName,
            rowNumbers,
            remarks: targetRemarks,
          };

          const response = await DashboardAPI.updateBatchRemarks(payload);
          if (!response.ok) {
            throw new Error(response.error || "Failed to update summary item");
          }
        } catch (error) {
          const pendingStatus: PendingStatus =
            targetRemarks === SHEET_STATUS.COMPLETED ? "done" : "undone";
          for (const row of relatedItems) {
            enqueueUpdate(buildQueueItemFromItem(row, pendingStatus));
          }

          const message =
            error instanceof DashboardAPIError
              ? error.message
              : "Failed to sync summary item now. It has been saved as pending.";
          Alert.alert("Pending Sync", message);
        } finally {
          setBusyMap((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
        return;
      }

      const currentItem = cacheItems.find((x) => isSameItem(x, item));
      const currentRemarks = currentItem?.remarks ?? item.remarks;
      const currentStatus = statusFromRemarks(currentRemarks);
      const pendingStatus = pendingByKey.get(key);

      if (pendingStatus) {
        if (isOffline) {
          const toggledStatus: PendingStatus =
            pendingStatus === "done" ? "undone" : "done";

          if (toggledStatus === currentStatus) {
            dequeueUpdateByKey(key);
          } else {
            enqueueUpdate(buildQueueItem(item, toggledStatus));
          }
          return;
        }

        setBusyMap((prev) => ({ ...prev, [key]: true }));
        try {
          const payload: UpdateRemarksPayload = {
            spreadsheetId: item.spreadsheetId,
            sheetName: item.sheetName,
            rowNumber: item.rowNumber,
            remarks: remarksFromStatus(pendingStatus),
          };

          const response = await DashboardAPI.updateRemarks(payload);
          if (!response.ok) {
            throw new Error(response.error || "Failed to sync pending item");
          }

          setCacheItems((prev) =>
            prev.map((x) =>
              isSameItem(x, item) ? { ...x, remarks: payload.remarks } : x,
            ),
          );
          dequeueUpdateByKey(key);
        } catch (error) {
          const message =
            error instanceof DashboardAPIError
              ? error.message
              : "Failed to sync pending item. Please try again.";
          Alert.alert("Sync Failed", message);
        } finally {
          setBusyMap((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
        return;
      }

      const nextStatus: PendingStatus = currentStatus === "done" ? "undone" : "done";

      if (isOffline) {
        enqueueUpdate(buildQueueItem(item, nextStatus));
        return;
      }

      const targetRemarks = remarksFromStatus(nextStatus);

      setCacheItems((prev) =>
        prev.map((x) => (isSameItem(x, item) ? { ...x, remarks: targetRemarks } : x)),
      );
      setBusyMap((prev) => ({ ...prev, [key]: true }));

      try {
        const payload: UpdateRemarksPayload = {
          spreadsheetId: item.spreadsheetId,
          sheetName: item.sheetName,
          rowNumber: item.rowNumber,
          remarks: targetRemarks,
        };

        const response = await DashboardAPI.updateRemarks(payload);
        if (!response.ok) {
          throw new Error(response.error || "Failed to update item");
        }
      } catch (error) {
        enqueueUpdate(buildQueueItem(item, nextStatus));

        const message =
          error instanceof DashboardAPIError
            ? error.message
            : "Failed to sync item now. It has been saved as pending.";

        Alert.alert("Pending Sync", message);
      } finally {
        setBusyMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [
      busyMap,
      cacheItems,
      pendingByKey,
      isOffline,
      dequeueUpdateByKey,
      enqueueUpdate,
      buildQueueItem,
      buildQueueItemFromItem,
    ],
  );

  const itemsWithKeys = transformItemsToView(cacheItems);

  return {
    loading,
    refreshing,
    items: itemsWithKeys,
    busyMap,
    pendingByKey,
    pendingSyncCount,
    isOffline,
    refresh,
    toggleItem,
  };
}
