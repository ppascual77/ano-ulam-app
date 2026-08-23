import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Clock } from "lucide-react-native";
import { AppText, Chips } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const IMAGE_HEIGHT = 160;

type TodaysPickCardProps = {
  meal: MealType;
  onPress: () => void;
};

// A single featured-meal card (e.g. Browse's "Today's pick") — simpler than
// MealCard (no like/save, no macro breakdown). The whole card opens the
// meal's detail sheet (MealDetailContent), same as MealCard.
export function TodaysPickCard({ meal, onPress }: TodaysPickCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <Image
        source={resolveMealImage(meal)}
        style={{ width: "100%", height: IMAGE_HEIGHT }}
        contentFit="cover"
      />

      <View className="px-4 pb-4 pt-3">
        <View className="flex-row items-center justify-between">
          {meal.total_time != null && (
            <Chips
              label={`${meal.total_time} min`}
              icon={<Clock color={colors.white} size={10} strokeWidth={2} />}
              bgClassName="bg-ink-emphasis"
            />
          )}
          <AppText variant="title" className="font-inter-semibold text-primary">
            ₱{meal.price}
            {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
          </AppText>
        </View>

        <AppText variant="title" numberOfLines={1} className="mt-2">
          {meal.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1} className="mt-1 leading-5">
          {meal.description}
        </AppText>
      </View>
    </Pressable>
  );
}
