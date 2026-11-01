import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight, PiggyBank } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import type { WeeklySavings } from "../hooks/useWeeklySavings";

const peso = (n: number) => `₱${Math.round(Math.abs(n)).toLocaleString("en-PH")}`;

type WeeklySavingsCardProps =
  | { locked: true; onUnlock: () => void }
  | { locked?: false; savings: WeeklySavings | null; empty: boolean; loading: boolean };

// Pro's weekly savings at the top of Price Watch: what your meal plan (or
// saved meals) costs less this week than at last week's prices, and the
// meals behind it. Free accounts get a locked teaser that opens the Pro
// upsell.
function WeeklySavingsCardInner(props: WeeklySavingsCardProps) {
  if (props.locked) {
    return (
      <Pressable
        onPress={props.onUnlock}
        className="flex-row items-center gap-3 rounded-2xl border border-ink-emphasis/10 p-3 active:bg-ink-emphasis/5"
      >
        <PiggyBank color={colors.primary} size={20} />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-inter-semibold text-body text-ink-emphasis">Your savings this week</Text>
            <ProBadge />
          </View>
          <Text className="font-inter-regular text-small text-ink-subtle">What price drops save you on your meals, in pesos.</Text>
        </View>
        <ChevronRight color={colors.ink.subtle} size={16} />
      </Pressable>
    );
  }

  const { savings, empty, loading } = props;
  if (loading) return null;

  const onWhat = savings?.source === "plan" ? "your meal plan" : "your saved meals";
  let headline: string;
  let detail: string;
  if (empty) {
    headline = "Your savings this week";
    detail = "Save meals or plan your week to see what price drops save you.";
  } else if (!savings || Math.round(savings.total) === 0) {
    headline = "No change this week";
    detail = `Prices on ${onWhat} are about the same as last week.`;
  } else if (savings.total > 0) {
    headline = `You save ${peso(savings.total)} this week`;
    detail = `On ${onWhat}, at this week's DA prices vs last week's.`;
  } else {
    headline = `${peso(savings.total)} more this week`;
    detail = `Prices went up on ${onWhat} since last week.`;
  }

  return (
    <View className="gap-2 rounded-2xl border border-ink-emphasis/10 bg-notice-positive-bg p-3">
      <View className="flex-row items-center gap-3">
        <PiggyBank color={colors.primary} size={20} />
        <View className="flex-1">
          <Text className="font-inter-bold text-body text-ink-emphasis">{headline}</Text>
          <Text className="font-inter-regular text-small text-ink-subtle">{detail}</Text>
        </View>
      </View>
      {savings && savings.total > 0 && savings.top.length > 0 && (
        <View className="gap-1 border-t border-ink-emphasis/10 pt-2">
          {savings.top.map((meal) => (
            <View key={meal.name} className="flex-row items-center justify-between gap-3">
              <Text numberOfLines={1} className="flex-1 font-inter-regular text-small text-ink">
                {meal.name}
              </Text>
              <Text className="font-inter-semibold text-small text-primary">−{peso(meal.saving)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const WeeklySavingsCard = memo(WeeklySavingsCardInner);
