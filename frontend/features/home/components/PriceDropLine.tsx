import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { BoilingDoodle, TREND_DOODLES, drawBoilPair } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Only a real drop is worth a line on Home (rounding noise isn't).
const MIN_DROP_PCT = 3;
// The hand-drawn down arrow, boiling like the rest of the brand doodles.
const DOWN = drawBoilPair(TREND_DOODLES.down);

// "Tomato, Local" -> "Tomato".
const shortName = (item: PriceItem) => item.name.split(",")[0].trim();

// The DA commodity whose price fell most since last week (Price Watch's own
// numbers), or null when nothing dropped enough.
export function useBiggestPriceDrop(): PriceItem | null {
  const { data } = usePriceItems();
  return useMemo(() => {
    const drops = (data ?? []).filter((i) => i.pctChange != null && i.pctChange <= -MIN_DROP_PCT);
    drops.sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0));
    return drops[0] ?? null;
  }, [data]);
}

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
