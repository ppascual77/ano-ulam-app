import { Pressable, Text, View } from "react-native";
import { formatPeso, trendOf, unitSuffix, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { FRESH_PICK_CARD_HEIGHT } from "./FreshPickCard";
import { RollingPrice } from "./RollingPrice";
import { TREND_TEXT, TrendIcon } from "./TrendIcon";

// Each row starts rolling a beat after the one above.
const ROW_DELAY_MS = 220;
const START_DELAY_MS = 300;

export const BOARD_ROWS = 3;

function BoardRow({ item, row, active, onPress }: { item: PriceItem; row: number; active: boolean; onPress: () => void }) {
  const pct = item.pctChange ?? 0;
  const unit = unitSuffix(item).replace("/", "per ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${item.name}, ${formatPeso(item.latestPrice)} ${unit}, ${pct > 0 ? "+" : ""}${pct}% vs last week`}
      className="flex-1 flex-row items-center gap-2 border-t border-white/10"
    >
      <Text numberOfLines={1} className="min-w-0 flex-1 font-inter-semibold text-body text-white">
        {item.name}
      </Text>

      <RollingPrice
        from={item.weekAgoPrice ?? item.latestPrice}
        to={item.latestPrice}
        active={active}
        delay={START_DELAY_MS + row * ROW_DELAY_MS}
      />

      {/* Percent chip with the unit under it ("per kg", "per pc"). */}
      <View className="items-center gap-1">
        <View className="min-w-14 flex-row items-center justify-center gap-0.5 rounded-full bg-white px-1.5 py-1">
          <TrendIcon pct={item.pctChange} size={10} />
          <Text className={`font-inter-extrabold text-sub ${TREND_TEXT[trendOf(item.pctChange)]}`}>
            {pct > 0 ? "+" : ""}
            {pct}%
          </Text>
        </View>
        <Text className="font-inter-regular text-sub text-white/50">{unit}</Text>
      </View>
    </Pressable>
  );
}

// First slide of "This week's fresh picks": a market-board summary of the
// top picks, each price rolling from last week's to today's whenever the
// board becomes the active slide.
// Tapping a row opens that item, same as its own card.
type FreshPicksBoardProps = { items: PriceItem[]; width: number; active: boolean; onSelect: (item: PriceItem) => void };

export function FreshPicksBoard({ items, width, active, onSelect }: FreshPicksBoardProps) {
  return (
    <View style={{ width, height: FRESH_PICK_CARD_HEIGHT, borderRadius: 24 }} className="overflow-hidden bg-brand-green-dark px-4 pb-1.5 pt-3.5">
      <View className="mb-2 flex-row justify-between">
        <Text className="font-inter-bold text-sub tracking-widest text-white/50">NCR · TODAY</Text>
        <Text className="font-inter-bold text-sub tracking-widest text-white/50">VS LAST WEEK</Text>
      </View>
      {items.slice(0, BOARD_ROWS).map((item, row) => (
        <BoardRow key={item.id} item={item} row={row} active={active} onPress={() => onSelect(item)} />
      ))}
    </View>
  );
}
