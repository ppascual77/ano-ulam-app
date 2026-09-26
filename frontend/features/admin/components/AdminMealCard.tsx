import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Clock, ImageOff } from "lucide-react-native";
import { AppText, Chips } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { MealRow } from "@/api/meals";

const IMAGE_HEIGHT = 150;

function MacroStat({ value, label, valueClassName }: { value: string; label: string; valueClassName: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className={`font-inter-regular text-body ${valueClassName}`}>{value}</Text>
      <Text className="font-inter-regular text-body text-ink-subtle">{label}</Text>
    </View>
  );
}

// Admin-side equivalent of core/meals' consumer MealCard — same visual
// language (rounded image, price in primary, macro breakdown row) but bound
// to the real `meals` table row instead of the mock-era MealType (still
// carbs/fats/buffer_price-shaped, not yet wired to the real schema). No
// like/bookmark affordances — not meaningful in an admin management list.
export function AdminMealCard({ meal, onPress }: { meal: MealRow; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <View className="relative">
        {meal.image_url ? (
          <Image source={{ uri: meal.image_url }} style={{ width: "100%", height: IMAGE_HEIGHT }} contentFit="cover" />
        ) : (
          <View style={{ height: IMAGE_HEIGHT }} className="items-center justify-center bg-ink-emphasis/5">
            <ImageOff color={colors.ink.subtle} size={22} />
          </View>
        )}

        {meal.total_time != null && (
          <View className="absolute right-2 top-2">
            <Chips label={`${meal.total_time} min`} icon={<Clock color={colors.white} size={10} strokeWidth={2} />} />
          </View>
        )}

        {!meal.ingredients_synced_at && (
          <View className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1">
            <Text className="font-inter-medium text-caption text-white">Not synced</Text>
          </View>
        )}
      </View>

      <View className="px-4 py-3">
        <AppText variant="title" numberOfLines={1} className="text-ink-emphasis">
          {meal.name}
        </AppText>

        <AppText variant="title" className="font-inter-semibold text-primary mt-1">
          {meal.price != null ? `₱${meal.price.toFixed(0)}` : "No price"}
        </AppText>

        <View className="mt-2 flex-row justify-between rounded-md border border-ink-emphasis/10 p-1">
          <MacroStat value={meal.calories != null ? `${Math.round(meal.calories)}` : "—"} label="kcal" valueClassName="text-ink" />
          <MacroStat value={meal.protein != null ? `${Math.round(meal.protein)}g` : "—"} label="Protein" valueClassName="text-macro-protein" />
          <MacroStat value={meal.carbohydrates != null ? `${Math.round(meal.carbohydrates)}g` : "—"} label="Carbs" valueClassName="text-macro-carbs" />
          <MacroStat value={meal.fat != null ? `${Math.round(meal.fat)}g` : "—"} label="Fats" valueClassName="text-macro-fats" />
        </View>
      </View>
    </Pressable>
  );
}
