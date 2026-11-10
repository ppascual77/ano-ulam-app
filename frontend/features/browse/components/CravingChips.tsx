import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Image, type ImageSource } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { EMPTY_FILTERS, type MealFilters } from "../utils/filters";

const SIZE = 68;
const snake = (t: string) => t.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/\s+/g, "_").toLowerCase();
const hasTag = (meal: MealType, tag: string) => (meal.tags ?? []).some((t) => snake(t) === tag);
const isProtein = (meal: MealType, ...types: string[]) => types.includes((meal.protein_type ?? "").toLowerCase());

type Craving = {
  label: string;
  /** The Browse search filters the chip applies. */
  filters: Partial<MealFilters>;
  /** Which catalog meals fit it (for the chip's photo). */
  fits: (meal: MealType) => boolean;
  /** Shown when no catalog meal with a photo fits. */
  icon: ImageSource | number;
  /** A catalog meal whose photo to use (part of its name), before any other
   *  that fits. Looked for among the chip's own meals first ("adobo" under
   *  Pork finds pork adobo, not egg adobo), then the whole catalog. */
  photoMeal?: string;
};

const CRAVINGS: Craving[] = [
  { label: "Soup", filters: { tags: ["soupy"] }, fits: (m) => hasTag(m, "soupy"), icon: require("@/assets/icons/fish-icon2.png") },
  { label: "Fried", filters: { tags: ["fried"] }, fits: (m) => hasTag(m, "fried"), icon: require("@/assets/icons/oil-icon.png"), photoMeal: "lumpiang togue" },
  { label: "Grilled", filters: { tags: ["grilled"] }, fits: (m) => hasTag(m, "grilled"), icon: require("@/assets/icons/meat-icon.png") },
  { label: "Veggies", filters: { proteinTypes: ["vegetable"] }, fits: (m) => isProtein(m, "vegetable", "vegetarian"), icon: require("@/assets/icons/vegetable.icon.png") },
  { label: "Fish", filters: { proteinTypes: ["seafood"] }, fits: (m) => isProtein(m, "seafood", "fish"), icon: require("@/assets/icons/fish-icon.png") },
  { label: "Chicken", filters: { proteinTypes: ["chicken"] }, fits: (m) => isProtein(m, "chicken"), icon: require("@/assets/icons/meat-icon.png"), photoMeal: "kinamatisang manok" },
  { label: "Pork", filters: { proteinTypes: ["pork"] }, fits: (m) => isProtein(m, "pork"), icon: require("@/assets/icons/pork-icon.png"), photoMeal: "adobo" },
];

function Chip({
  craving,
  photo,
  selected,
  onPress,
}: {
  craving: Craving;
  photo: ImageSource | number | null;
  /** The picked one: accent ring, check badge, accent label. */
  selected: boolean;
  onPress: () => void;
}) {
  const ring = selected ? colors.accent : colors.white;
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={selected ? `${craving.label}, selected. Tap to clear` : `Show ${craving.label} meals`}
      accessibilityState={{ selected }}
      className="items-center"
    >
      <View>
        <View style={{ width: SIZE, height: SIZE }} className="rounded-full bg-white">
          {photo ? (
            <Image source={photo} style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: ring }} contentFit="cover" />
          ) : (
            <View
              style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, borderColor: ring }}
              className="items-center justify-center bg-mood-bg"
            >
              <Image source={craving.icon} style={{ width: SIZE * 0.55, height: SIZE * 0.55 }} contentFit="contain" />
            </View>
          )}
          {selected && (
            <View className="absolute -right-0.5 -top-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-accent">
              <Check color={colors.white} size={12} strokeWidth={3} />
            </View>
          )}
        </View>
      </View>
      <Text className={`mt-2 text-small ${selected ? "font-inter-bold text-accent" : "font-inter-semibold text-ink-emphasis"}`}>{craving.label}</Text>
    </Pressable>
  );
}

// Browse's "Craving something?" row: one tap applies a ready-made filter
// (Soup = soupy, Veggies = vegetable, …) and shows the results. Each chip shows a real catalog meal that
// fits it, or a food icon when none with a photo does. Runs edge to edge.
export function CravingChips({
  selected = null,
  onPick,
  onClear,
}: {
  /** The picked chip's label (its results are showing), or null. */
  selected?: string | null;
  onPick: (label: string, filters: MealFilters) => void;
  onClear: () => void;
}) {
  const { meals } = usePreferredMeals();
  const photos = useMemo(() => {
    const used = new Set<string>();
    return CRAVINGS.map((c) => {
      const free = (m: MealType) => !!m.image_url && !used.has(m.id ?? m.name);
      const named = (m: MealType) => !!c.photoMeal && m.name.toLowerCase().includes(c.photoMeal);
      const meal =
        meals.find((m) => free(m) && named(m) && c.fits(m)) ||
        meals.find((m) => free(m) && named(m)) ||
        meals.find((m) => free(m) && c.fits(m));
      if (!meal) return null;
      used.add(meal.id ?? meal.name);
      return resolveMealImage(meal);
    });
  }, [meals]);

  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <AppText variant="sectionTitle" dot>
          Craving something?
        </AppText>
        {selected && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <Pressable
              onPress={onClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${selected}`}
              className="flex-row items-center gap-1 rounded-full bg-ink-emphasis/5 px-3 py-1.5 active:opacity-70"
            >
              <X color={colors.ink.subtle} size={14} strokeWidth={2.5} />
              <Text className="font-inter-semibold text-small text-ink-subtle">Clear</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
      {/* Edge to edge past the screen's px-5. No shadows on the chips: the
          scroller clipped them into a hard line. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-4 px-5 pb-1 pt-2">
        {CRAVINGS.map((c, i) => (
          <Chip
            key={c.label}
            craving={c}
            photo={photos[i]}
            selected={selected === c.label}
            onPress={() => onPick(c.label, { ...EMPTY_FILTERS, ...c.filters })} />
        ))}
      </ScrollView>
    </View>
  );
}
