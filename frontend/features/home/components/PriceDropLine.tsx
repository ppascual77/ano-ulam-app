import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { BoilingDoodle, TREND_DOODLES, drawBoilPair } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { commodityShortName, useBiggestPriceDrop } from "@/frontend/core/prices/hooks/useBiggestPriceDrop";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// The hand-drawn down arrow, boiling like the rest of the brand doodles.
const DOWN = drawBoilPair(TREND_DOODLES.down);

const shortName = commodityShortName;
// Re-exported for Home (the hook lives with Price Watch's data).
export { useBiggestPriceDrop };

// Home's live line under the greeting: one price drop from Price Watch
// ("Tomato is 12% cheaper than last week"), on a glass pill over the green.
// Opens Price Watch.
export function PriceDropLine({ item }: { item: PriceItem }) {
  const reduce = useReduceMotion();
  const pct = Math.round(Math.abs(item.pctChange ?? 0));
  return (
    <Pressable
      onPress={() => router.navigate("/price-watch")}
      accessibilityRole="link"
      accessibilityLabel={`${shortName(item)} is ${pct}% cheaper than last week. Open Price Watch`}
      className="mt-3 flex-row items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 py-1.5 pl-1.5 pr-3 active:bg-white/20"
    >
      <View className="h-6 w-6 items-center justify-center rounded-full bg-white/15">
        <BoilingDoodle versions={DOWN} size={15} color={colors.home.name} strokeWidth={2.6} paused={reduce} />
      </View>
      <Text numberOfLines={1} className="shrink font-inter-semibold text-small text-white">
        {shortName(item)} is <Text className="text-home-name">{pct}% cheaper</Text> than last week
      </Text>
      <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
    </Pressable>
  );
}
