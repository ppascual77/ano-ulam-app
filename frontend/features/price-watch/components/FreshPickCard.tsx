import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { BoilingDoodle, TREND_DOODLES, drawBoilPair } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { formatPeso, trendOf, unitSuffix, type PriceItem, type Trend } from "@/frontend/core/prices/utils/prices";
import { RollingPrice } from "./RollingPrice";

// Let the slide-in mostly finish before the digits start rolling.
const ROLL_DELAY_MS = 250;

// Shared by every fresh picks slide (cards and the board), so paging never
// changes the section's height.
export const FRESH_PICK_CARD_HEIGHT = 180;

// [from, to] stops, cycled by card position.
const GRADIENTS: [string, string][] = [
  ["#065F46", "#052e16"], // emerald-800 -> green-950
  ["#0f766e", "#064e3b"], // teal-700 -> emerald-900
  ["#15803d", "#134e4a"], // green-700 -> teal-900
];

// Big faint hand-drawn trend arrow in the corner, with the same two-version
// "line boil" as the confetti doodles. Purely decorative.
function TrendScribble({ trend, paused }: { trend: Trend; paused: boolean }) {
  const [versions] = useState(() => drawBoilPair(TREND_DOODLES[trend]));
  return (
    <View pointerEvents="none" className="absolute right-4 top-4 opacity-20">
      <BoilingDoodle versions={versions} size={76} color={colors.white} strokeWidth={2} paused={paused} />
    </View>
  );
}

type FreshPickCardProps = {
  item: PriceItem;
  index: number;
  width: number;
  /** The shown slide: its price rolls from last week's to today's. */
  active: boolean;
  onPress: () => void;
};

// No product photo — the gradient, a hand-drawn trend arrow, and the text.
//
// The gradient is an absolute-fill background behind a plain View, rather
// than LinearGradient itself being the outer/touchable element — inside a
// horizontal Carousel nested in the page's vertical ScrollView, having
// LinearGradient (a custom native view) sit directly in the scroll gesture's
// hit-testing path blocked both scroll directions for this whole section.
export function FreshPickCard({ item, index, width, active, onPress }: FreshPickCardProps) {
  const pct = item.pctChange ?? 0;
  const trend = trendOf(item.pctChange);
  const ChangeIcon = pct < 0 ? TrendingDown : pct > 0 ? TrendingUp : Minus;
  // A group with no drops shows its most stable item, which may have gone
  // up a little: say so instead of calling it stable.
  const change = pct < 0 ? `${Math.abs(pct)}% cheaper this week` : pct > 0 ? `${pct}% up this week` : "Stable this week";

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${item.name}, ${change}, ${formatPeso(item.latestPrice)} ${unitSuffix(item)}${
        item.weekAgoPrice != null ? `, was ${formatPeso(item.weekAgoPrice)}` : ""
      }`}
      style={{ width, height: FRESH_PICK_CARD_HEIGHT, borderRadius: 24 }}
      className="overflow-hidden"
    >
      <LinearGradient
        colors={GRADIENTS[index % GRADIENTS.length]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Only the shown slide boils; the others hold still. */}
      <TrendScribble key={trend} trend={trend} paused={!active} />

      <View className="flex-1 justify-between p-5">
        <View className="flex-row items-center gap-1 self-start rounded-full border border-white/20 bg-white/15 px-2.5 py-1">
          <ChangeIcon color={colors.white} size={12} />
          <Text className="font-inter-semibold text-sub text-white">{change}</Text>
        </View>

        <View>
          <Text numberOfLines={1} className="pr-20 font-inter-extrabold text-heading text-white">
            {item.name}
          </Text>
          {/* Same split-flap price as the board. */}
          <View className="my-1 flex-row items-end gap-1.5">
            <RollingPrice from={item.weekAgoPrice ?? item.latestPrice} to={item.latestPrice} active={active} delay={ROLL_DELAY_MS} size="lg" />
            <Text className="font-inter-regular text-body text-white/50">{unitSuffix(item)}</Text>
          </View>
          {item.weekAgoPrice != null && (
            <Text className="font-inter-regular text-small text-white/70">was {formatPeso(item.weekAgoPrice)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
