import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { BottomSheet, Button } from "@/frontend/components/ui";
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
        <View>
          <Text className="font-inter-bold text-subheading text-web-ink">
            Your next {lockedDays} days are <Text className="text-brand-orange">ready</Text>
          </Text>
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

// Premium: pick another meal for one slot of the day.
export function SwapMealSheet({ slot, options, showMacros, onClose, onSwap }: SwapMealSheetProps) {
  const [picked, setPicked] = useState<PlannerMeal | null>(null);
  // Keep the title while closing.
  const [shownSlot, setShownSlot] = useState<MealSlot | null>(slot);
  useEffect(() => {
    if (slot) {
      setShownSlot(slot);
      setPicked(null);
    }
  }, [slot]);

  const label = shownSlot ? SLOT_LABELS[shownSlot] : "";

  return (
    <BottomSheet visible={!!slot} onClose={onClose} heightPercent={0.85} fitContent>
      <View className="gap-4 px-6 pb-8 pt-10">
        <View>
          <Text className="font-inter-bold text-subheading text-web-ink">Swap {label}</Text>
          <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">Choose another meal for {label.toLowerCase()}.</Text>
        </View>

        {options.length === 0 ? (
          <Text className="py-6 text-center font-inter-regular text-body text-web-ink-muted">
            No other meals fit today's budget.
          </Text>
        ) : (
          <View className="gap-2">
            {options.map((meal) => {
              const selected = picked?.id === meal.id;
              return (
                <Pressable
                  key={meal.id}
                  onPress={() => setPicked(meal)}
                  accessibilityState={{ selected }}
                  className={`flex-row items-center gap-3 rounded-2xl border p-2.5 ${
                    selected ? "border-brand-green bg-brand-green/5" : "border-web-divider"
                  }`}
                >
                  <MealImage meal={meal} height={56} width={56} rounded="rounded-xl" />
                  <View className="flex-1">
                    <Text numberOfLines={2} className="font-inter-semibold text-body text-web-ink">
                      {meal.name}
                    </Text>
                    <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">
                      {showMacros
                        ? `${meal.calories} kcal · ${meal.protein}g P · ${meal.carbs}g C · ${meal.fats}g F`
                        : `${meal.calories} kcal · ₱${Math.round(Number(meal.price) / (meal.serving_size ?? 1))} per person`}
                    </Text>
                  </View>
                  <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-brand-green" : "border-web-ink-faint"}`}>
                    {selected && <View className="h-2.5 w-2.5 rounded-full bg-brand-green" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Button label="Use this meal" onPress={() => picked && onSwap(picked)} disabled={!picked} />
      </View>
    </BottomSheet>
  );
}
