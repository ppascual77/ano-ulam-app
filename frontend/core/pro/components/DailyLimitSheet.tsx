import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { ArrowRight } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "./ProBadge";
import { track } from "@/frontend/core/analytics/analytics";

type DailyLimitSheetProps = {
  visible: boolean;
  /** Which limit, for analytics (limit_sheet_shown). */
  kind: "search" | "budget" | "pantry" | "saved_meals";
  /** Plural, lowercase: "searches", "budget suggestions". */
  what: string;
  /** Today's limit for this user. */
  limit: number | null;
  onClose: () => void;
  /** "Unlock Pro": called once this sheet has fully closed (see
   *  ProUpgradeSheet's onOpenPro), e.g. to open the Pro page. */
  onOpenPro: () => void;
  /** Other limits (e.g. the saved-meals cap): replace the daily wording. */
  title?: string;
  body?: string;
  /** A quiet link under the button (e.g. "Manage saved meals"), run once
   *  the sheet has closed. */
  secondary?: { label: string; onPress: () => void };
  /** "inline" when shown over another open sheet (Meal Details). */
  presentation?: "modal" | "inline";
};

// Shown when a free user tries something new after using up a daily limit
// (see dailyLimits): Browse search, Suggest by Budget, Suggest by Pantry.
// Same look as ProUpgradeSheet, kept short: what ran out, the same quiet
// "See all Pro features" line, and Unlock Pro.
export function DailyLimitSheet({ visible, kind, what, limit, onClose, onOpenPro, title, body, secondary, presentation }: DailyLimitSheetProps) {
  useEffect(() => {
    if (visible) track("limit_sheet_shown", { kind });
  }, [visible, kind]);
  const openProPending = useRef(false);
  const secondaryPending = useRef(false);
  const openPro = () => {
    openProPending.current = true;
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        if (secondaryPending.current) {
          secondaryPending.current = false;
          secondary?.onPress();
        }
        if (!openProPending.current) return;
        openProPending.current = false;
        onOpenPro();
      }}
      fitContent
      presentation={presentation}
    >
      <View className="px-6 pb-8 pt-10">
        <View className="items-start gap-3">
          <ProBadge />
          <View>
            <AppText variant="sectionTitle" dot>
              {title ?? `You're out of ${what} for today`}
            </AppText>
            <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
              {body ?? `Free accounts get ${limit ?? ""} ${what} a day, and they reset at midnight. Pro has no daily limit.`}
            </Text>
          </View>
        </View>
        {/* Same line as ProUpgradeSheet's "Just a few highlights. See all
            Pro features": unlimited use is only one of Pro's benefits. */}
        <Pressable
          onPress={openPro}
          accessibilityRole="button"
          accessibilityLabel="Just one of Pro's benefits. See all Pro features."
          hitSlop={8}
          className="mt-5 flex-row items-center gap-1 self-start active:opacity-60"
        >
          <Text className="font-inter-regular text-small text-ink-subtle">
            Just one of Pro&apos;s benefits. <Text className="font-inter-semibold text-ink-emphasis">See all Pro features</Text>
          </Text>
          <ArrowRight color={colors.ink.emphasis} size={14} />
        </Pressable>
        <View className="mt-7">
          <Button label="Unlock Pro" variant="secondary" onPress={openPro} />
        </View>
        {secondary && (
          <Pressable
            onPress={() => {
              secondaryPending.current = true;
              onClose();
            }}
            accessibilityRole="button"
            hitSlop={8}
            className="mt-4 items-center py-1 active:opacity-60"
          >
            <Text className="font-inter-semibold text-small text-ink-subtle">{secondary.label}</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}
