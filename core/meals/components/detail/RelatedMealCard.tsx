import { DimensionValue, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Clock, TrendingDown } from "lucide-react-native";
import { colors } from "@/constants/theme";
import { resolveMealImage } from "../../resolveMealImage";
import type { MealType } from "../../mealTypes";

type RelatedMealCardProps = {
  meal: MealType;
  onPress: () => void;
  /** Defaults to "48%" (a 2-column grid). Pass a fixed pixel width for a carousel. */
  width?: DimensionValue;
  /** Shows a "cheaper this week" note flush at the bottom of the card, in
   *  NoticeBanner's amber color theme (e.g. Home's "This week's best value
   *  meals" carousel). Defaults to false. */
  showValueNote?: boolean;
};

// Mobile-only, so just the web version's vertical layout — no
// horizontal/desktop variant needed.
export function RelatedMealCard({ meal, onPress, width = "48%", showValueNote = false }: RelatedMealCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      className="overflow-hidden rounded-xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: 85 }} contentFit="cover" />

      <View className="justify-between p-2" style={{ height: 80 }}>
        <Text numberOfLines={2} className="font-inter-semibold text-body text-ink-emphasis" style={{ minHeight: 32 }}>
          {meal.name}
        </Text>
        <Text className="font-inter-semibold text-body text-primary">
          ₱{meal.price}
          {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
        </Text>
        <View className="flex-row items-center justify-between">
          {meal.total_time != null && (
            <View className="flex-row items-center gap-1">
              <Clock color={colors.ink.subtle} size={12} />
              <Text className="text-caption text-ink-subtle">{meal.total_time} min</Text>
            </View>
          )}
          <Text className="font-inter-bold text-caption text-ink">{meal.calories} cal</Text>
        </View>
      </View>

      {showValueNote && (
        <View className="flex-row items-center gap-1 border-t border-notice-border bg-notice-bg px-2 py-1.5">
          <TrendingDown color={colors.notice.icon} size={12} />
          <Text className="flex-1 text-caption text-notice-text">
            Some ingredients in this meal are cheaper this week
          </Text>
        </View>
      )}
    </Pressable>
  );
}
