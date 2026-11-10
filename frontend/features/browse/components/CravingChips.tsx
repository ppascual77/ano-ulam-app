import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Image, type ImageSource } from "expo-image";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { EMPTY_FILTERS, type MealFilters } from "../utils/filters";

const SIZE = 68;
const snake = (t: string) => t.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/\s+/g, "_").toLowerCase();
const hasTag = (meal: MealType, tag: string) => (meal.tags ?? []).some((t) => snake(t) === tag);
const isProtein = (meal: MealType, ...types: string[]) => types.includes((meal.protein_type ?? "").toLowerCase());

type Craving = {
  label: string;
  /** The Browse filters the chip applies (the same ones as the filter sheet). */
  filters: Partial<MealFilters>;
  /** Which catalog meals fit it (for the chip's photo). */
  fits: (meal: MealType) => boolean;
  /** Shown when no catalog meal with a photo fits. */
  icon: ImageSource | number;
};

const CRAVINGS: Craving[] = [
  { label: "Sabaw", filters: { tags: ["soupy"] }, fits: (m) => hasTag(m, "soupy"), icon: require("@/assets/icons/fish-icon2.png") },
  { label: "Prito", filters: { tags: ["fried"] }, fits: (m) => hasTag(m, "fried"), icon: require("@/assets/icons/oil-icon.png") },
  { label: "Inihaw", filters: { tags: ["grilled"] }, fits: (m) => hasTag(m, "grilled"), icon: require("@/assets/icons/meat-icon.png") },
  { label: "Gulay", filters: { proteinTypes: ["vegetable"] }, fits: (m) => isProtein(m, "vegetable", "vegetarian"), icon: require("@/assets/icons/vegetable.icon.png") },
  { label: "Isda", filters: { proteinTypes: ["seafood"] }, fits: (m) => isProtein(m, "seafood", "fish"), icon: require("@/assets/icons/fish-icon.png") },
  { label: "Manok", filters: { proteinTypes: ["chicken"] }, fits: (m) => isProtein(m, "chicken"), icon: require("@/assets/icons/meat-icon.png") },
  { label: "Baboy", filters: { proteinTypes: ["pork"] }, fits: (m) => isProtein(m, "pork"), icon: require("@/assets/icons/pork-icon.png") },
];

function Chip({ craving, photo, onPress }: { craving: Craving; photo: ImageSource | number | null; onPress: () => void }) {
  const reduce = useReduceMotion();
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        if (!reduce) press.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 12, stiffness: 320 });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Show ${craving.label} meals`}
      className="items-center"
    >
      <Animated.View style={style}>
        <View style={{ width: SIZE, height: SIZE }} className="rounded-full bg-white shadow-md">
          {photo ? (
            <Image source={photo} style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: colors.white }} contentFit="cover" />
          ) : (
            <View
              style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: colors.white }}
              className="items-center justify-center bg-mood-bg"
            >
              <Image source={craving.icon} style={{ width: SIZE * 0.55, height: SIZE * 0.55 }} contentFit="contain" />
            </View>
          )}
        </View>
      </Animated.View>
      <Text className="mt-2 font-inter-semibold text-small text-ink-emphasis">{craving.label}</Text>
    </Pressable>
  );
}

// Browse's "Craving something?" row: one tap applies a ready-made filter
// (Sabaw = soupy, Gulay = vegetable, …) and shows the results, the same as
// picking it in the filter sheet. Each chip shows a real catalog meal that
// fits it, or a food icon when none with a photo does. Runs edge to edge.
export function CravingChips({ onPick }: { onPick: (filters: MealFilters) => void }) {
  const { meals } = usePreferredMeals();
  const photos = useMemo(() => {
    const used = new Set<string>();
    return CRAVINGS.map((c) => {
      const meal = meals.find((m) => m.image_url && !used.has(m.id ?? m.name) && c.fits(m));
      if (!meal) return null;
      used.add(meal.id ?? meal.name);
      return resolveMealImage(meal);
    });
  }, [meals]);

  return (
    <View>
      <AppText variant="sectionTitle" dot className="mb-3">
        Craving something?
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-7" contentContainerClassName="gap-4 px-7 pb-1">
        {CRAVINGS.map((c, i) => (
          <Chip key={c.label} craving={c} photo={photos[i]} onPress={() => onPick({ ...EMPTY_FILTERS, ...c.filters })} />
        ))}
      </ScrollView>
    </View>
  );
}
