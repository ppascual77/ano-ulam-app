import { Pressable, Text, View } from "react-native";
import { formatPeso, trendOf, unitLabel, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { TREND_TEXT, TrendIcon } from "./TrendIcon";

export function PriceRow({ item, onPress }: { item: PriceItem; onPress: () => void }) {
  const pct = item.pctChange;
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center gap-2 rounded-2xl border border-ink-emphasis/10 p-3 active:bg-ink-emphasis/5"
    >
      <TrendIcon pct={pct} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-inter-semibold text-body text-ink">
          {item.name}
        </Text>
        {!!item.specification && (
          <Text numberOfLines={1} className="font-inter-regular text-sub text-ink-subtle">
            {item.specification}
          </Text>
        )}
      </View>
      <View className="items-end">
        <View className="flex-row items-baseline gap-1">
          <Text className="font-inter-bold text-body text-ink">{formatPeso(item.latestPrice)}</Text>
          {pct != null && (
            <Text className={`font-inter-semibold text-sub ${TREND_TEXT[trendOf(pct)]}`}>
              ({pct > 0 ? "+" : ""}
              {pct}%)
            </Text>
          )}
        </View>
        <Text className="font-inter-regular text-sub text-ink-subtle">{unitLabel(item)}</Text>
      </View>
    </Pressable>
  );
}
