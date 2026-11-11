import { Pressable, Text, View } from "react-native";
import { formatPeso, trendOf, unitSuffix, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { PriceSparkline } from "./PriceSparkline";
import { TREND_TEXT } from "./TrendIcon";

const TREND_BG = { down: "bg-trend-down/10", up: "bg-trend-up/10", flat: "bg-trend-flat/15" } as const;

// "↓ 4.3%", "↑ 1.5%", or "Steady" (no change, or no week-ago price).
export function changeLabel(pct: number | null) {
  const trend = trendOf(pct);
  if (trend === "flat" || pct == null) return "Steady";
  return `${trend === "down" ? "↓" : "↑"} ${Math.abs(pct)}%`;
}

// The week's change as a small tinted pill.
export function ChangePill({ pct }: { pct: number | null }) {
  const trend = trendOf(pct);
  return (
    <View className={`self-end rounded-full px-2 py-0.5 ${TREND_BG[trend]}`}>
      <Text className={`font-inter-bold text-sub ${TREND_TEXT[trend]}`}>{changeLabel(pct)}</Text>
    </View>
  );
}

type PriceRowProps = {
  item: PriceItem;
  onPress: () => void;
  /** Shown instead of the commodity name (a kind inside a folded family). */
  title?: string;
  /** Staggers the sparkline's draw in a list. */
  delay?: number;
  /** No divider under it (the last row of a list). */
  last?: boolean;
};

// One commodity, compact: its week as a sparkline, the name (and DA's
// specification), today's price with its unit, and the change pill. Rows
// sit on hairlines instead of each in its own box.
export function PriceRow({ item, onPress, title, delay, last = false }: PriceRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title ?? item.name}, ${formatPeso(item.latestPrice)} ${unitSuffix(item)}, ${changeLabel(item.pctChange)}`}
      className={`flex-row items-center gap-3 py-2.5 active:opacity-70 ${last ? "" : "border-b border-ink-emphasis/5"}`}
    >
      <PriceSparkline item={item} delay={delay} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-inter-semibold text-body text-ink-emphasis">
          {title ?? item.name}
        </Text>
        {!!item.specification && (
          <Text numberOfLines={1} className="font-inter-regular text-sub text-ink-subtle">
            {item.specification}
          </Text>
        )}
      </View>
      <View className="items-end gap-1">
        <Text className="font-inter-extrabold text-body text-ink-emphasis">
          {formatPeso(item.latestPrice)}
          <Text className="font-inter-medium text-sub text-ink-subtle">{unitSuffix(item)}</Text>
        </Text>
        <ChangePill pct={item.pctChange} />
      </View>
    </Pressable>
  );
}
