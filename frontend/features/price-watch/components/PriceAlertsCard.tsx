import { memo } from "react";
import { Text, View } from "react-native";
import { BellRing } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { PriceAlert } from "@/frontend/core/prices/hooks/usePriceAlerts";
import type { PriceItem } from "@/frontend/core/prices/utils/prices";
import { PriceRow } from "./PriceRow";

type PriceAlertsCardProps = {
  alerts: PriceAlert[];
  onSelect: (item: PriceItem) => void;
};

// Pro: the price drop alerts at the top of Price Watch: each watched
// ingredient that's cheaper this week, as its biggest-drop DA commodity's
// row (tap for the price detail). Hidden when nothing dropped.
function PriceAlertsCardInner({ alerts, onSelect }: PriceAlertsCardProps) {
  if (alerts.length === 0) return null;
  return (
    <View className="rounded-2xl border border-ink-emphasis/10 bg-notice-positive-bg p-3 pb-1">
      <View className="mb-3 flex-row items-center gap-2">
        <BellRing color={colors.primary} size={16} />
        <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis">
          {alerts.length === 1 ? "1 price drop on your list" : `${alerts.length} price drops on your list`}
        </Text>
      </View>
      {alerts.map((alert) => (
        <View key={alert.ingredientId} className="rounded-2xl bg-white">
          <PriceRow item={alert.item} onPress={() => onSelect(alert.item)} />
        </View>
      ))}
    </View>
  );
}

export const PriceAlertsCard = memo(PriceAlertsCardInner);
