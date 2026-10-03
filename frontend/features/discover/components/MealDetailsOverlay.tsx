import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Clock, Store } from "lucide-react-native";
import { MealInfoPill } from "@/frontend/core/meals/components/MealInfoPill";
import { MacroBreakdown } from "@/frontend/core/meals/components/card/MacroBreakdown";
import { colors } from "@/frontend/constants/theme";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { PosterRow } from "./PosterRow";

// Bottom-left text block over the active reel meal. The screen remounts it
// (keyed by meal) on every index change, so it fades in on top of the
// already-snapped photo: the core "reel" feel. Only the poster row takes
// touches (opens the poster's profile); everything else passes them through
// to the pager, so swiping over the text still changes meals.
export function MealDetailsOverlay({ meal, onPressPoster }: { meal: MealType; onPressPoster: () => void }) {
  const isFastFood = meal.category === "fast_food" && !!meal.restaurant;

  return (
    <Animated.View entering={FadeIn.duration(250)} pointerEvents="box-none" className="gap-2">
      <View pointerEvents="none" className="gap-2">
      <Text className="font-inter-bold text-heading leading-7 text-white">{meal.name}</Text>

      {isFastFood && (
        <View className="flex-row self-start items-center gap-1 rounded-full bg-brand-orange px-2 py-1">
          <Store color={colors.white} size={10} />
          <Text className="font-inter-semibold text-sub text-white">{meal.restaurant}</Text>
        </View>
      )}

      <View className="flex-row items-baseline gap-2">
        <Text className="font-inter-semibold text-body text-white">
          ₱{meal.price}
          {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
        </Text>
        <Text className="font-inter-regular text-sub text-white/50">Estimated Price</Text>
      </View>

      {!!meal.description && (
        <Text className="font-inter-regular text-body text-white/70" numberOfLines={2}>
          {meal.description}
        </Text>
      )}

      <View className="flex-row flex-wrap gap-2">
        <MealInfoPill meal={meal} variant="reel" />
        {meal.prep_time != null && (
          <View className="flex-row items-center rounded-xl bg-white/20 px-2 py-1">
            <Clock color={colors.white} strokeWidth={1.5} size={14} />
            <Text className="ml-1 font-inter-regular text-sub text-white">{meal.prep_time} min</Text>
          </View>
        )}
      </View>

      <MacroBreakdown
        variant="dark"
        macros={{ calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fats: meal.fats }}
      />

      </View>

      <PosterRow posterId={meal.poster_id} onPress={onPressPoster} />
    </Animated.View>
  );
}
