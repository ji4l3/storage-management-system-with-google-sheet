import React from "react";
import { Alert, Pressable, Text } from "react-native";

import { UI_CONFIG } from "@/constants/dashboard";

interface BuswayButtonProps {
  buswayTitle: string;
  description: string;
  done: boolean;
  pending: boolean;
  pendingTarget?: "done" | "undone";
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export const BuswayButton = React.memo<BuswayButtonProps>(
  ({
    buswayTitle,
    description,
    done,
    pending,
    pendingTarget,
    busy,
    disabled = false,
    onPress,
  }) => {
    const handleLongPress = () => {
      Alert.alert(
        buswayTitle || "Item Details",
        description || "No description available",
        [{ text: "OK", style: "default" }],
      );
    };

    return (
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        disabled={busy || disabled}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${buswayTitle}, ${description}, ${pending ? "pending sync" : done ? "completed" : "not completed"}`}
        accessibilityHint={
          pending
            ? "Double tap to sync or modify pending action"
            : done
            ? "Double tap to mark as incomplete"
            : "Double tap to mark as complete"
        }
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 92,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: pending
            ? UI_CONFIG.colors.pending
            : done
              ? UI_CONFIG.colors.accent
              : UI_CONFIG.colors.border,
          backgroundColor: pending
            ? "rgba(255,157,47,0.22)"
            : done
              ? "rgba(57,217,138,0.22)"
            : pressed
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.15)",
          padding: 10,
          margin: 6,
          justifyContent: "center",
          opacity: busy || disabled ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            color: UI_CONFIG.colors.textPrimary,
            fontWeight: "900",
            fontSize: 16,
            textAlign: "center",
            includeFontPadding: false,
            lineHeight: 20,
          }}
          numberOfLines={1}
        >
          {buswayTitle || "—"}
        </Text>

        <Text
          style={{
            color: UI_CONFIG.colors.textSecondary,
            marginTop: 6,
            fontSize: 11,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {description || "—"}
        </Text>

        <Text
          style={{
            marginTop: 6,
            fontWeight: "800",
            textAlign: "center",
            color: pending
              ? UI_CONFIG.colors.pending
              : done
              ? UI_CONFIG.colors.accent
              : UI_CONFIG.colors.textSecondary,
            fontSize: 10,
          }}
        >
          {busy
            ? "UPDATING..."
            : disabled
              ? "QTY SUMMARY"
            : pending
              ? pendingTarget === "done"
                ? "PENDING COMPLETE"
                : "PENDING UNDO"
            : done
              ? "DONE (tap to undo)"
              : "TAP TO COMPLETE"}
        </Text>
      </Pressable>
    );
  },
);

BuswayButton.displayName = "BuswayButton";
