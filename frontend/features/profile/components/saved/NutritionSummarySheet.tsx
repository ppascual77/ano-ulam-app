import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Droplets, Dumbbell, Target, Wheat, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MacroSection } from "@/frontend/core/meals/components/detail/MacroSection";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { SavedMeal } from "@/frontend/core/saved/types";

type MacroKey = "protein" | "fats" | "carbs";

const INSIGHTS: { key: MacroKey; title: string; description: string; Icon: LucideIcon; color: string; textClassName: string }[] = [
  {
    key: "protein",
    title: "Protein Powerhouse",
    description: "The meal carrying the most protein across your saved list.",
    Icon: Dumbbell,
    color: colors.macro.protein,
    textClassName: "text-macro-protein",
  },
  {
    key: "fats",
    title: "Fat-Dense Pick",
    description: "Highest fat content among all your saved meals.",
    Icon: Droplets,
    color: colors.macro.fats,
    textClassName: "text-macro-fats",
  },
  {
    key: "carbs",
    title: "Carb Leader",
    description: "The meal contributing the most carbohydrates to your total.",
    Icon: Wheat,
    color: colors.macro.carbs,
    textClassName: "text-macro-carbs",
  },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

// Combined macros of every saved meal (at its saved servings), a donut of
// the totals, and which meal leads each macro. "Set Goals" is coming soon.
// (The web also adds rice servings; saved meals here don't carry rice yet.)
export function NutritionSummarySheet({ visible, onClose, saved }: { visible: boolean; onClose: () => void; saved: SavedMeal[] }) {
  const [goalsOpen, setGoalsOpen] = useState(false);

  const totals = saved.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fats: sum.fats + meal.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
  const top = (key: MacroKey) => saved.reduce<SavedMeal | null>((best, meal) => (!best || meal[key] > best[key] ? meal : best), null);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.85}
      fitContent
      overlay={
        <BottomSheet visible={goalsOpen} onClose={() => setGoalsOpen(false)} presentation="inline" fitContent heightPercent={0.6}>
          <View className="items-center gap-3 px-6 pb-8 pt-10">
            <Text className="text-heading">🎯</Text>
            <AppText variant="sectionTitle" dot className="text-center">
              Goal setting is <Text className="text-brand-orange">coming soon</Text>
            </AppText>
            <Text className="text-center font-inter-regular text-body text-web-ink-muted">
              We're working on letting you set your own calorie and macro targets, so suggestions can be tailored to your actual
              goal, whether that's building muscle, losing weight, or just eating better.
            </Text>
            <Text className="text-center font-inter-regular text-small text-web-ink-muted">
              For now, AnoUlam uses general dietary guidelines to spot macro gaps in your saved meals.
            </Text>
            <View className="mt-2 w-full">
              <Button label="Got it" onPress={() => setGoalsOpen(false)} />
            </View>
          </View>
        </BottomSheet>
      }
    >
      <View className="gap-4 px-4 pb-6 pt-10">
        <View>
          <Text className="font-inter-semibold text-body text-web-ink">Macro Summary</Text>
          <Text className="mt-0.5 font-inter-light text-small text-web-ink-muted">Total combined macros from all your saved meals.</Text>
        </View>

        {saved.length === 0 ? (
          <Text className="font-inter-regular text-body text-web-ink-muted">Save meals to see your combined macro summary.</Text>
        ) : (
          <>
            <MacroSection
              calories={Math.round(totals.calories)}
              protein={Math.round(totals.protein)}
              carbs={Math.round(totals.carbs)}
              fats={round1(totals.fats)}
            />

            <Text className="font-inter-semibold text-sub uppercase text-web-ink-muted">Insights</Text>
            {INSIGHTS.map((insight) => {
              const meal = top(insight.key);
              if (!meal) return null;
              return (
                <View key={insight.key} className="gap-2.5 rounded-xl border border-web-divider p-3">
                  <View className="flex-row items-center gap-1.5">
                    <insight.Icon color={insight.color} size={13} />
                    <Text className="font-inter-semibold text-small text-web-ink">{insight.title}</Text>
                  </View>
                  <Text className="font-inter-light text-sub text-web-ink-muted">{insight.description}</Text>
                  <View className="flex-row items-center gap-2.5">
                    <Image source={resolveMealImage(meal)} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                    <Text numberOfLines={1} className="flex-1 font-inter-medium text-small text-web-ink">
                      {meal.name}
                    </Text>
                    <Text className={`font-inter-bold text-small ${insight.textClassName}`}>{round1(meal[insight.key])}g</Text>
                  </View>
                </View>
              );
            })}

            <Pressable onPress={() => setGoalsOpen(true)} hitSlop={6} className="flex-row items-center gap-1 self-end">
              <Target color={colors.brandGreen.DEFAULT} size={12} />
              <Text className="font-inter-regular text-sub text-brand-green underline">Set Goals</Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
