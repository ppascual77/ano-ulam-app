import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowRight, Check, Crown, Plus, X } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { SLOT_LABELS } from "../utils/generatePlan";
import type { MealSlot, PlannerMeal } from "../mock/plannerMeals";
import { MealImage } from "./ImagePlaceholder";

const BENEFITS = ["Full 5-day meal plan", "Unlimited meal planning", "Swap meals", "Personalized nutrition planning"];

type LockedDaySheetProps = {
  visible: boolean;
  /** How many days are locked (for the title). */
  lockedDays: number;
  onClose: () => void;
  onUnlock: () => void;
};

// Free user tapping a locked day (or Swap): a light upsell, not a paywall.
export function LockedDaySheet({ visible, lockedDays, onClose, onUnlock }: LockedDaySheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.7} fitContent>
      <View className="gap-5 px-6 pb-8 pt-10">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/15">
          <Crown color={colors.brandOrange} size={24} />
        </View>
        <View>
          <AppText variant="sectionTitle" dot>
            Your next {lockedDays} days are <Text className="text-brand-orange">ready</Text>
          </AppText>
          <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">Unlock the full 5-day plan with AnoUlam Premium.</Text>
        </View>
        <View className="gap-2.5">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-green">
                <Check color={colors.white} size={12} strokeWidth={3} />
              </View>
              <Text className="font-inter-medium text-body text-web-ink-soft">{benefit}</Text>
            </View>
          ))}
        </View>
        <View className="gap-3">
          <Button label="Unlock Premium" onPress={onUnlock} />
          <Pressable onPress={onClose} hitSlop={8} className="items-center">
            <Text className="font-inter-medium text-body text-web-ink-muted">Not now</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

type SwapMealSheetProps = {
  /** null closes the sheet. */
  slot: MealSlot | null;
  options: PlannerMeal[];
  showMacros: boolean;
  onClose: () => void;
  onSwap: (meal: PlannerMeal) => void;
};

// Filter chips, in this order, shown only for proteins the options have.
const PROTEIN_FILTERS: { value: string; label: string }[] = [
  { value: "chicken", label: "Chicken" },
  { value: "pork", label: "Pork" },
  { value: "beef", label: "Beef" },
  { value: "seafood", label: "Seafood" },
  { value: "egg", label: "Egg" },
  { value: "veg", label: "Veg" },
];

// Premium: pick another meal for one slot of the day.
export function SwapMealSheet({ slot, options, showMacros, onClose, onSwap }: SwapMealSheetProps) {
  const [picked, setPicked] = useState<PlannerMeal | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  // Keep the title while closing.
  const [shownSlot, setShownSlot] = useState<MealSlot | null>(slot);
  useEffect(() => {
    if (slot) {
      setShownSlot(slot);
      setPicked(null);
      setFilter(null);
    }
  }, [slot]);

  const label = shownSlot ? SLOT_LABELS[shownSlot] : "";
  const filters = PROTEIN_FILTERS.filter((f) => options.some((m) => m.protein_type === f.value));
  const shown = filter ? options.filter((m) => m.protein_type === filter) : options;

  return (
    <BottomSheet visible={!!slot} onClose={onClose} heightPercent={0.85}>
      <View className="flex-1 pt-8">
        <View className="flex-row items-start justify-between px-6">
          <View className="flex-1">
            <AppText variant="sectionTitle" dot>{`Swap ${label}`}</AppText>
            <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">Choose another meal for {label.toLowerCase()}.</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X color={colors.webInk.muted} size={20} />
          </Pressable>
        </View>

        {filters.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 max-h-10 flex-grow-0" contentContainerClassName="gap-2 px-6">
            {[{ value: null as string | null, label: "All" }, ...filters].map((f) => {
              const active = filter === f.value;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setFilter(f.value)}
                  className={`rounded-full border px-4 py-1.5 ${active ? "border-brand-green bg-brand-green" : "border-web-divider bg-white"}`}
                >
                  <Text className={`font-inter-medium text-small ${active ? "text-white" : "text-web-ink-soft"}`}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <ScrollView className="mt-4 flex-1" contentContainerClassName="gap-2 px-6 pb-4" showsVerticalScrollIndicator={false}>
          {shown.length === 0 ? (
            <Text className="py-6 text-center font-inter-regular text-body text-web-ink-muted">No other meals fit today's budget.</Text>
          ) : (
            shown.map((meal) => {
              const selected = picked?.id === meal.id;
              return (
                <Pressable
                  key={meal.id}
                  onPress={() => setPicked(meal)}
                  accessibilityState={{ selected }}
                  className={`flex-row items-center gap-3 rounded-2xl border p-2 ${selected ? "border-brand-green bg-brand-green/5" : "border-web-divider bg-white"}`}
                >
                  <MealImage meal={meal} height={64} width={64} rounded="rounded-xl" />
                  <View className="flex-1">
                    <Text numberOfLines={2} className="font-inter-semibold text-body text-web-ink">
                      {meal.name}
                    </Text>
                    <Text className="mt-0.5 font-inter-regular text-sub text-web-ink-muted">
                      {showMacros
                        ? `${meal.calories} kcal · ${meal.protein}g P · ${meal.carbs}g C · ${meal.fats}g F`
                        : `${meal.calories} kcal · ₱${Math.round(Number(meal.price) / (meal.serving_size ?? 1))} per person`}
                    </Text>
                  </View>
                  {selected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-green">
                      <Check color={colors.white} size={14} strokeWidth={3} />
                    </View>
                  ) : (
                    <View className="h-6 w-6 items-center justify-center rounded-full border border-web-ink-faint">
                      <Plus color={colors.webInk.soft} size={14} />
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <View className="px-6 pb-6 pt-2">
          <Button
            label="Use this meal"
            icon={<ArrowRight color={colors.white} size={18} />}
            iconPosition="right"
            onPress={() => picked && onSwap(picked)}
            disabled={!picked}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
