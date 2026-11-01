import { memo } from "react";
import { Text, View } from "react-native";
import { BellRing } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { formatShortDate, type PriceItem } from "@/frontend/core/prices/utils/prices";
import { PriceRow } from "./PriceRow";

type PriceAlertsCardProps = {
  /** The latest DA report's date (ISO). */
  date: string;
  drops: PriceItem[];
  onSelect: (item: PriceItem) => void;
};

// Pro's daily price alert at the top of Price Watch: the biggest drops in
// the latest DA report, as their price rows (tap for the price detail).
// Hidden when nothing dropped.
function PriceAlertsCardInner({ date, drops, onSelect }: PriceAlertsCardProps) {
  if (drops.length === 0) return null;
  return (
    <View className="rounded-2xl border border-ink-emphasis/10 bg-notice-positive-bg p-3 pb-1">
      <View className="mb-3 flex-row items-center gap-2">
        <BellRing color={colors.primary} size={16} />
        <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis">Biggest price drops today</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{formatShortDate(date)}</Text>
      </View>
      {drops.map((item) => (
        <View key={item.id} className="rounded-2xl bg-white">
          <PriceRow item={item} onPress={() => onSelect(item)} />
        </View>
      ))}
    </View>
  );
}

export const PriceAlertsCard = memo(PriceAlertsCardInner);
