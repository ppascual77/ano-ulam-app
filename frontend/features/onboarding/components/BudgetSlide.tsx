import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AppText, RollingText, Stepper } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { matchBudget } from "@/frontend/core/budget/utils/budgetMatch";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HighlightedText } from "./HighlightedText";
import type { BudgetSlideData } from "../slides";

const MAX_SERVINGS = 10;
const PHOTO = 32;
const PHOTOS = 3;
// Each photo sits this far over the one before.
const OVERLAP = PHOTO * 0.35;

type Props = {
  slide: BudgetSlideData;
  width: number;
  budget: number;
  servings: number;
  onBudgetChange: (budget: number) => void;
  onServingsChange: (servings: number) => void;
};

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-2 font-inter-bold text-sub uppercase tracking-wide text-ink-placeholder">{children}</Text>;
}

// Onboarding's budget question, as one calm panel like "In your kitchen":
// the budget as four even options, who it feeds with the share per person,
// and a quiet line of what it gets you (real meals that fit, counted live).
// Home opens with those meals suggested.
export function BudgetSlide({ slide, width, budget, servings, onBudgetChange, onServingsChange }: Props) {
  const reduceMotion = useReduceMotion();
  const { data: meals } = useRealMeals();
  // Home-cooked meals for this budget and people (preferences come later,
  // on Home).
  const fits = useMemo(
    () => matchBudget(meals ?? [], budget, servings, []).filter((m) => m.meal.category !== "fast_food"),
    [meals, budget, servings],
  );
  const photos = fits.filter((m) => m.meal.image_url).slice(0, PHOTOS);
  const each = Math.round(budget / servings);

  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <AppText variant="subhero" className="tracking-display" dot>
          {slide.title}
        </AppText>
        <HighlightedText className="mt-2">{slide.subtitle}</HighlightedText>

        <View className="mt-7 rounded-2xl border border-ink-emphasis/10 bg-white px-4">
          {/* The budget: four even options, one always picked. */}
          <View className="py-4">
            <SectionLabel>Budget per meal</SectionLabel>
            <View className="flex-row gap-2">
              {slide.budgets.map((amount) => {
                const on = amount === budget;
                return (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      if (on) return;
                      Haptics.selectionAsync();
                      onBudgetChange(amount);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`₱${amount}`}
                    className={`h-12 flex-1 items-center justify-center rounded-xl border ${on ? "border-primary bg-primary/5" : "border-ink-emphasis/10 bg-white"} active:opacity-70`}
                  >
                    <Text className={`text-body ${on ? "font-inter-bold text-primary" : "font-inter-semibold text-ink-emphasis"}`}>₱{amount}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Who it feeds, and what that leaves each. */}
          <View className="flex-row items-center justify-between gap-3 border-t border-ink-emphasis/5 py-4">
            <View className="flex-1">
              <SectionLabel>Cooking for</SectionLabel>
              <Text className="font-inter-semibold text-body text-ink-emphasis">
                {servings} {servings === 1 ? "person" : "people"}
                <Text className="font-inter-regular text-ink-subtle"> · about ₱{each} each</Text>
              </Text>
            </View>
            <Stepper
              value={servings}
              min={1}
              max={MAX_SERVINGS}
              onChange={(n) => {
                Haptics.selectionAsync();
                onServingsChange(n);
              }}
              decrementLabel="Fewer people"
              incrementLabel="More people"
            />
          </View>

          {/* What it gets you: real meals that fit, counted as you choose. */}
          <View className="flex-row items-center gap-3 border-t border-ink-emphasis/5 py-4">
            {photos.length > 0 && (
              <View style={{ width: PHOTO + (photos.length - 1) * (PHOTO - OVERLAP), height: PHOTO }}>
                {photos.map(({ meal }, i) => (
                  <Animated.View
                    key={meal.id ?? meal.name}
                    entering={reduceMotion ? undefined : FadeIn.duration(240)}
                    exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                    style={{ position: "absolute", left: i * (PHOTO - OVERLAP), zIndex: PHOTOS - i }}
                  >
                    <View className="overflow-hidden rounded-full border-2 border-white" style={{ width: PHOTO, height: PHOTO }}>
                      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
            <View className="flex-1 flex-row items-baseline gap-1">
              <RollingText value={fits.length} rank={fits.length} className="font-inter-bold text-body text-ink-emphasis" />
              <Text className="font-inter-regular text-body text-ink-subtle">
                {fits.length === 0 ? "meals fit. Try a little more." : fits.length === 1 ? "meal fits, ready on Home" : "meals fit, ready on Home"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
