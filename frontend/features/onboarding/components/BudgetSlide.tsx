import { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { User } from "lucide-react-native";
import { AppText, ChipSelect, RollingText, Stepper } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { matchBudget } from "@/frontend/core/budget/utils/budgetMatch";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { HighlightedText } from "./HighlightedText";
import type { BudgetSlideData } from "../slides";

const MAX_SERVINGS = 10;
// People drawn as little figures up to this many, then "+N".
const FIGURES = 6;
const PHOTO = 44;
const PHOTOS = 3;

type Props = {
  slide: BudgetSlideData;
  width: number;
  budget: number;
  servings: number;
  onBudgetChange: (budget: number) => void;
  onServingsChange: (servings: number) => void;
};

// Onboarding's budget question. The amount is the hero (a big number that
// rolls as you pick), the people are drawn as figures, and a live preview
// shows real meals that fit, so the question explains itself: a budget in,
// meals out. Home opens with those meals suggested.
export function BudgetSlide({ slide, width, budget, servings, onBudgetChange, onServingsChange }: Props) {
  const reduceMotion = useReduceMotion();
  const { data: meals } = useRealMeals();
  // Home-cooked meals for this budget and people (preferences come later,
  // on Home): the count and three photos for the preview.
  const fits = useMemo(
    () => matchBudget(meals ?? [], budget, servings, []).filter((m) => m.meal.category !== "fast_food"),
    [meals, budget, servings],
  );
  const photos = fits.filter((m) => m.meal.image_url).slice(0, PHOTOS);
  const each = Math.round(budget / servings);
  const fade = reduceMotion ? undefined : FadeIn.duration(260);
  const fadeOut = reduceMotion ? undefined : FadeOut.duration(180);

  return (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <AppText variant="subhero" className="tracking-display" dot>
          {slide.title}
        </AppText>
        <HighlightedText className="mt-2">{slide.subtitle}</HighlightedText>

        {/* The amount, big: rolls up or down as a chip is picked. */}
        <View className="mt-7 flex-row items-end gap-3">
          <RollingText
            value={`₱${budget}`}
            rank={budget}
            className="font-inter-extrabold text-hero tracking-display text-primary"
          />
          <Text className="mb-3 font-inter-medium text-body text-ink-subtle">≈ ₱{each} each</Text>
        </View>
        <View className="mt-3">
          <ChipSelect
            options={slide.budgets.map((amount) => ({ id: String(amount), label: `₱${amount}` }))}
            mode="single"
            required
            value={[String(budget)]}
            onChange={(value) => {
              if (!value[0]) return;
              Haptics.selectionAsync();
              onBudgetChange(Number(value[0]));
            }}
          />
        </View>

        {/* Who it feeds: the stepper, with the people drawn beside it. */}
        <View className="mt-7 flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <AppText variant="sectionSubtitle" dot>
              Cooking for
            </AppText>
            <View className="mt-2 flex-row items-center gap-0.5">
              {Array.from({ length: Math.min(servings, FIGURES) }, (_, i) => (
                <Animated.View key={i} entering={fade} exiting={fadeOut}>
                  <User color={colors.primary} size={18} strokeWidth={2.4} />
                </Animated.View>
              ))}
              {servings > FIGURES && <Text className="ml-1 font-inter-semibold text-small text-primary">+{servings - FIGURES}</Text>}
            </View>
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
      </View>

      {/* What the budget gets you, live: real meals that fit, their count
          rolling and their photos changing with the picks. */}
      <View className="mb-2 flex-row items-center gap-3 rounded-2xl bg-tinted-bg/60 px-4 py-3">
        <View className="flex-row" style={{ width: PHOTO + (PHOTOS - 1) * (PHOTO * 0.6), height: PHOTO }}>
          {photos.map(({ meal }, i) => (
            <Animated.View
              key={meal.id ?? meal.name}
              entering={fade}
              exiting={fadeOut}
              style={{ position: "absolute", left: i * PHOTO * 0.6, zIndex: PHOTOS - i }}
            >
              <View className="overflow-hidden rounded-full border-2 border-white" style={{ width: PHOTO, height: PHOTO }}>
                <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </View>
            </Animated.View>
          ))}
        </View>
        <View className="flex-1">
          <View className="flex-row items-baseline gap-1">
            <RollingText value={fits.length} rank={fits.length} className="font-inter-extrabold text-subheading text-primary" />
            <Text className="font-inter-bold text-body text-ink-emphasis">{fits.length === 1 ? "meal fits" : "meals fit"}</Text>
          </View>
          <Text className="font-inter-regular text-small text-ink-subtle">
            {fits.length > 0 ? "They'll be waiting for you on Home." : "Try a bit more, and we'll find some."}
          </Text>
        </View>
      </View>
    </View>
  );
}
