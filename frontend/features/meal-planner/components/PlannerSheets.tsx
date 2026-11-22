import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { ArrowRight, Check, Flame, X } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { SLOT_LABELS } from "../utils/generatePlan";
import type { MealSlot, PlannerMeal } from "../utils/generatePlan";
import { MealImage } from "./ImagePlaceholder";
import { MACROS } from "./PlanParts";

type SwapMealSheetProps = {
  /** null closes the sheet. */
  slot: MealSlot | null;
  options: PlannerMeal[];
  showMacros: boolean;
  /** The meal being swapped out: each option says how its price compares. */
  current?: PlannerMeal | null;
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
// One person's price of a meal, rounded (catalog prices cover serving_size).
const perPerson = (meal: PlannerMeal) => Math.round(Number(meal.price) / (meal.serving_size ?? 1));

export function SwapMealSheet({ slot, options, current, onClose, onSwap }: SwapMealSheetProps) {
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
              const price = perPerson(meal);
              const diff = current ? price - perPerson(current) : 0;
              return (
                <Pressable
                  key={meal.id}
                  onPress={() => setPicked(meal)}
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${meal.name}, ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)} grams protein, ₱${price} per person${diff ? `, ₱${Math.abs(diff)} ${diff < 0 ? "less" : "more"}` : ""}`}
                  className={`gap-2.5 rounded-2xl border p-2.5 ${selected ? "border-brand-green bg-brand-green/5" : "border-web-divider bg-white"}`}
                >
                  <View className="flex-row gap-3">
                    <View>
                      <MealImage meal={meal} height={72} width={72} rounded="rounded-xl" />
                      {selected && (
                        <View className="absolute inset-0 items-center justify-center rounded-xl bg-brand-green/60">
                          <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                            <Check color={colors.brandGreen.DEFAULT} size={16} strokeWidth={3} />
                          </View>
                        </View>
                      )}
                    </View>
                    <View className="flex-1 justify-center">
                      <Text numberOfLines={2} className="font-inter-semibold text-body text-web-ink">
                        {meal.name}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        <Flame color={colors.brandOrange} size={13} />
                        <Text className="font-inter-regular text-small text-web-ink-muted">
                          <Text className="font-inter-bold text-web-ink">{Math.round(meal.calories).toLocaleString("en-PH")}</Text> kcal
                        </Text>
                      </View>
                    </View>
                    <View className="items-end justify-center">
                      <Text className="font-inter-extrabold text-subheading text-web-ink">₱{price}</Text>
                      <Text className="font-inter-regular text-sub text-web-ink-muted">per person</Text>
                      {diff !== 0 && (
                        <Text className={`mt-0.5 font-inter-semibold text-sub ${diff < 0 ? "text-primary" : "text-web-ink-muted"}`}>
                          ₱{Math.abs(diff)} {diff < 0 ? "less" : "more"}
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* The macros as tinted chips in their colors (same as the
                      plan's nutrition card). */}
                  <View className="flex-row gap-1.5">
                    {MACROS.map(({ key, label, color, tint }) => (
                      <View key={key} className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-1.5 ${tint}`}>
                        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <Text numberOfLines={1} adjustsFontSizeToFit className="shrink font-inter-regular text-sub text-web-ink-muted">
                          {label} <Text className="font-inter-bold text-web-ink">{Math.round(meal[key])}g</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
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
