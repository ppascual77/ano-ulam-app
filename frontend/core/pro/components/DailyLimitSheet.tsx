import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "./ProBadge";

type DailyLimitSheetProps = {
  visible: boolean;
  /** Plural, lowercase: "searches", "budget suggestions". */
  what: string;
  /** Today's limit for this user. */
  limit: number | null;
  onClose: () => void;
  /** "Unlock Pro": called once this sheet has fully closed (see
   *  ProUpgradeSheet's onOpenPro), e.g. to open the Pro page. */
  onOpenPro: () => void;
};

// Shown when a free user tries something new after using up a daily limit
// (see dailyLimits): Browse search, Suggest by Budget, Suggest by Pantry.
// Same look as ProUpgradeSheet, kept short: what ran out, the same quiet
// "See all Pro features" line, and Unlock Pro.
export function DailyLimitSheet({ visible, what, limit, onClose, onOpenPro }: DailyLimitSheetProps) {
  const openProPending = useRef(false);
  const openPro = () => {
    openProPending.current = true;
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        if (!openProPending.current) return;
        openProPending.current = false;
        onOpenPro();
      }}
      fitContent
    >
      <View className="px-6 pb-8 pt-10">
        <View className="items-start gap-3">
          <ProBadge />
          <View>
            <AppText variant="sectionTitle" dot>
              {`You're out of ${what} for today`}
            </AppText>
            <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
              Free accounts get {limit ?? ""} {what} a day, and they reset at midnight. Pro has no daily limit.
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
      </View>
    </BottomSheet>
  );
}
