import { View } from "react-native";
import { Image } from "expo-image";
import { resolveMealImage } from "../../resolveMealImage";
import type { MealType } from "../../mealTypes";
import { CARD_OVERLAP, HERO_HEIGHT } from "./MealDetailContent";

function Bar({ w, h = 14, className = "" }: { w: number | `${number}%`; h?: number; className?: string }) {
  return <View className={`rounded-full bg-ink-emphasis/5 ${className}`} style={{ width: w, height: h }} />;
}

// What the meal page shows while it slides up: the real photo (already
// cached from the card that was tapped) and the card's outline in soft
// bars, laid out like MealDetailContent so the real page lands without a
// jump. Rendering the full page during the slide made opening it lag.
export function MealDetailSkeleton({ meal }: { meal: MealType }) {
  return (
    <View className="flex-1 bg-white">
      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: HERO_HEIGHT }} contentFit="cover" />
      <View className="flex-1 rounded-t-3xl bg-white px-6 pt-5" style={{ marginTop: -CARD_OVERLAP }}>
        <View className="flex-row items-start justify-between">
          <View className="gap-2.5">
            <Bar w={190} h={24} />
            <Bar w={150} h={32} />
          </View>
          <View className="items-end gap-2">
            <Bar w={70} h={20} />
            <Bar w={84} h={12} />
          </View>
        </View>
        <View className="mt-5 gap-2">
          <Bar w="100%" />
          <Bar w="92%" />
          <Bar w="70%" />
        </View>
        <View className="mt-5 flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="h-20 flex-1 rounded-2xl bg-ink-emphasis/5" />
          ))}
        </View>
        <Bar w={120} h={22} className="mt-6" />
        <View className="mt-3 h-36 rounded-2xl bg-ink-emphasis/5" />
      </View>
    </View>
  );
}
