import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { Beef, Drumstick, Fish, Ham, Leaf, X } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MACRO_PILLS_CONFIG, MACRO_RULES, NON_MACRO_RULES, NON_NUTRITION_PILLS_CONFIG } from "@/frontend/core/meals/utils/constants";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const PROTEIN_TYPE_FILTERS = [
  { id: "chicken", label: "Chicken", icon: Drumstick, color: "#CA8A04" },
  { id: "pork", label: "Pork", icon: Ham, color: "#DB2777" },
  { id: "beef", label: "Beef", icon: Beef, color: "#DC2626" },
  { id: "seafood", label: "Seafood", icon: Fish, color: "#0EA5E9" },
  { id: "veggie", label: "Veggie", icon: Leaf, color: "#16A34A" },
];

// Reuse the exact icon/color/label already defined for these pills
// (getMealPills) instead of re-inventing a second definition of "Quick" etc.
function tagFilter(id: string, pill: { label: string; bgColor: string; icon: typeof PROTEIN_TYPE_FILTERS[number]["icon"] }) {
  return { id, label: pill.label, color: pill.bgColor, icon: pill.icon };
}

const TAG_FILTERS = [
  tagFilter("highProtein", MACRO_PILLS_CONFIG.highProtein),
  tagFilter("quick", NON_NUTRITION_PILLS_CONFIG.quick),
  tagFilter("lowCarb", MACRO_PILLS_CONFIG.lowCarb),
];

const FILTERS = [...PROTEIN_TYPE_FILTERS, ...TAG_FILTERS];

/** Whether a meal passes one chip. Pass the meal per serving: the macro
 *  chips' thresholds are per serving (high protein is 30 g or more). */
export function passesQuickFilter(meal: MealType, filterId: string) {
  if (filterId === "highProtein") return MACRO_RULES.highProtein(meal);
  if (filterId === "lowCarb") return MACRO_RULES.lowCarb(meal);
  if (filterId === "quick") return NON_MACRO_RULES.quick(meal);
  // The catalog types plant-based meals "vegetable" or "vegetarian".
  if (filterId === "veggie") return ["veggie", "vegetable", "vegetarian", "veg"].includes(meal.protein_type ?? "");
  return meal.protein_type === filterId;
}

type QuickFiltersProps = {
  /** The active budget, shown as the leading chip (with an x when
   *  onClearBudget is given). */
  budgetLabel?: string;
  onClearBudget?: () => void;
  selected: string[];
  onChange: (selected: string[]) => void;
};

type Filter = (typeof FILTERS)[number];

// One chip. Selecting it: the fill blooms out from the middle in the chip's
// color while the label crossfades to white, with a small press-and-settle.
// Deselecting reverses the fill. Reduce motion: just the quick crossfade.
function FilterChip({ filter, selected, onPress }: { filter: Filter; selected: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: reduce ? 120 : 200, easing: Easing.out(Easing.cubic) });
  }, [selected, on, reduce]);

  const tap = () => {
    void Haptics.selectionAsync();
    if (!reduce) press.value = withSequence(withTiming(0.92, { duration: 70 }), withSpring(1, { damping: 12, stiffness: 320, mass: 0.5 }));
    onPress();
  };

  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: reduce ? 1 : 0.6 + 0.4 * on.value }],
  }));
  const outlineLabel = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const filledLabel = useAnimatedStyle(() => ({ opacity: on.value }));
  const Icon = filter.icon;

  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={filter.label}>
      <Animated.View
        style={[{ borderWidth: 1, borderColor: filter.color, backgroundColor: colors.white }, chipStyle]}
        className="overflow-hidden rounded-full"
      >
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: 999, backgroundColor: filter.color }, fillStyle]}
        />
        {/* The outlined label sizes the chip; the white one sits exactly on it. */}
        <Animated.View style={outlineLabel} className="flex-row items-center gap-1.5 px-3 py-1.5">
          <Icon color={filter.color} size={13} />
          <Text className="font-inter-medium text-caption" style={{ color: filter.color }}>
            {filter.label}
          </Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }, filledLabel]}
          className="flex-row items-center justify-center gap-1.5 px-3 py-1.5"
        >
          <Icon color={colors.white} size={13} />
          <Text className="font-inter-medium text-caption text-white">{filter.label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function QuickFilters({ budgetLabel, onClearBudget, selected, onChange }: QuickFiltersProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <View className="gap-2">
      <AppText variant="title">Quick Filters</AppText>
      <View className="flex-row flex-wrap items-center gap-2">
        {budgetLabel && (
          <View className="flex-row items-center gap-1.5 rounded-full bg-primary py-1.5 pl-3 pr-2">
            <Text className="font-inter-semibold text-caption text-white">₱{budgetLabel}</Text>
            {onClearBudget && (
              <Pressable onPress={onClearBudget} hitSlop={8}>
                <X color={colors.white} size={12} />
              </Pressable>
            )}
          </View>
        )}

        {FILTERS.map((filter) => (
          <FilterChip key={filter.id} filter={filter} selected={selected.includes(filter.id)} onPress={() => toggle(filter.id)} />
        ))}
      </View>
    </View>
  );
}
