import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "./BottomSheet";
import { Spinner } from "./Spinner";
import { colors } from "@/frontend/constants/theme";

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  /** Optional icon tile above the title. */
  icon?: ReactNode;
  /** Line(s) under the title. A string renders as muted body text. */
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "destructive" paints the confirm button red (like color), "primary" green. */
  tone?: "destructive" | "primary";
  /** Disables both buttons and shows a spinner on confirm. */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onClosed?: () => void;
  /** "inline" when shown inside another sheet's `overlay` (Modals don't stack). */
  presentation?: "modal" | "inline";
};

// Centered title + two buttons in a fit-content sheet. Used for "Delete this
// post?", "Remove this meal?", "This recipe is live" etc.
export function ConfirmSheet({
  visible,
  title,
  icon,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "destructive",
  busy = false,
  onCancel,
  onConfirm,
  onClosed,
  presentation,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={busy ? () => {} : onCancel}
      onClosed={onClosed}
      heightPercent={0.5}
      fitContent
      presentation={presentation}
    >
      <View className="items-center gap-5 px-6 pb-8 pt-12">
        {icon}
        <View className="items-center">
          <Text className="text-center font-inter-bold text-subheading text-web-ink">{title}</Text>
          {typeof body === "string" ? (
            <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">{body}</Text>
          ) : (
            body
          )}
        </View>
        <View className="w-full flex-row gap-3">
          <Pressable
            onPress={onCancel}
            disabled={busy}
            className="flex-1 items-center rounded-xl border border-web-ink-muted py-2.5"
          >
            <Text className="font-inter-medium text-body text-web-ink-soft">{cancelLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
              tone === "destructive" ? "bg-like" : "bg-primary"
            }`}
          >
            {busy && <Spinner size={14} color={colors.white} />}
            <Text className="font-inter-semibold text-body text-white">{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
