import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { Target } from "lucide-react-native";
import { AppText, BottomSheet, Button, DotLabel, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MacroSection } from "@/frontend/core/meals/components/detail/MacroSection";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { MACROS, leaderFor, macroSplit, round1, sumSaved, type MacroKey } from "./nutritionTotals";

// The opening sequence, the same rhythm as Price Watch's detail sheet and
// replayed on every open:
//   0ms     blocks rise in one after another (STAGGER_MS apart)
//   250ms   the donut's calories count up from 0 to the total
//   ~200ms  inside the leaders card, each row follows its card in
const STAGGER_MS = 90;
const ENTER_MS = 420;
const COUNT_DELAY_MS = 250;
const COUNT_MS = 900;
const ROW_STAGGER_MS = 70;

const CARD = "rounded-3xl border border-ink-emphasis/10 bg-white p-4";

const LEADER_LABEL: Record<MacroKey, string> = { protein: "Most protein", fats: "Most fat", carbs: "Most carbs" };

// One plain sentence on the mix, so the donut has a takeaway, not just
// numbers. Only for a clear lead; a near-even mix just says so.
function mixTakeaway(split: Record<MacroKey, number>): string {
  const [first, second] = [...MACROS].sort((a, b) => split[b.key] - split[a.key]);
  if (split[first.key] - split[second.key] < 5) return "A fairly even mix across protein, fat and carbs.";
  const verb = first.key === "carbs" ? "bring" : "brings";
  return `${first.label} ${verb} the most calories, at ${split[first.key]}% of the total.`;
}

type BodyProps = { saved: SavedMeal[]; onClose: () => void };

// The sheet's content. Keyed per open by NutritionSummarySheet, so mounting
// it plays the opening sequence again.
function SummaryBody({ saved, onClose }: BodyProps) {
  const reduceMotion = useReduceMotion();
  const enter = (step: number, extraMs = 0) =>
    reduceMotion ? undefined : FadeInDown.delay(step * STAGGER_MS + extraMs).duration(ENTER_MS);

  const totals = sumSaved(saved);
  const split = macroSplit(totals);
  const calories = Math.round(totals.calories);
  const shownCalories = Math.round(useCountTo(0, calories, COUNT_DELAY_MS, COUNT_MS));
  const count = saved.length;
  const leaders = MACROS.flatMap((m) => {
    const meal = leaderFor(saved, m.key);
    return meal ? [{ ...m, meal }] : [];
  });

  return (
    <View className="gap-4 px-5 pb-8 pt-6">
      {/* What this is. */}
      <Animated.View entering={enter(0)} className="mb-1">
        <DotLabel className="mb-1">{`${count} saved ${count === 1 ? "meal" : "meals"}`}</DotLabel>
        <AppText variant="sectionTitle" dot>
          Your macro mix
        </AppText>
        <AppText variant="caption">Everything you&apos;ve saved, added up at the servings you saved it with.</AppText>
      </Animated.View>

      {/* The total, and what it's made of. */}
      <Animated.View entering={enter(1)} className={CARD}>
        <DotLabel className="mb-3">Combined total</DotLabel>
        <MacroSection calories={shownCalories} protein={Math.round(totals.protein)} carbs={Math.round(totals.carbs)} fats={round1(totals.fats)} />
        <Text className="mt-3 border-t border-ink-emphasis/10 pt-3 font-inter-regular text-small text-ink-subtle">
          {mixTakeaway(split)}
        </Text>
      </Animated.View>

      {/* Which meal tips each macro. Needs two meals to mean anything. */}
      <Animated.View entering={enter(2)} className={CARD}>
        <DotLabel>Top meal per macro</DotLabel>
        {count < 2 || leaders.length === 0 ? (
          <Text className="mt-2 font-inter-regular text-small text-ink-subtle">
            Save one more meal to see which one leads in protein, fat and carbs.
          </Text>
        ) : (
          <View className="mt-1">
            {leaders.map((leader, i) => (
              <Animated.View
                key={leader.key}
                entering={enter(2, (i + 1) * ROW_STAGGER_MS)}
                className={`flex-row items-center gap-3 py-3 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}
              >
                <Image source={resolveMealImage(leader.meal)} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
                <View className="flex-1">
                  <Text className={`font-inter-semibold text-sub uppercase ${leader.textClassName}`}>{LEADER_LABEL[leader.key]}</Text>
                  <Text numberOfLines={1} className="mt-1 font-inter-medium text-body text-ink-emphasis">
                    {leader.meal.name}
                  </Text>
                </View>
                <Text style={{ fontVariant: ["tabular-nums"] }} className={`font-inter-bold text-body ${leader.textClassName}`}>
                  {round1(leader.meal[leader.key])}g
                </Text>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Honest about what's missing: no targets yet, so no judgement. */}
      <Animated.View entering={enter(3)}>
        <NoticeBanner tone="positive" compact icon={<Target color={colors.primary} size={16} />}>
          <Text className="font-inter-semibold text-small text-ink-emphasis">Personal goals are on the way</Text>
          <Text className="font-inter-regular text-small text-ink-subtle">
            Soon you&apos;ll set calorie and macro targets and see how your saved meals measure up. For now, treat these totals as a
            guide.
          </Text>
        </NoticeBanner>
      </Animated.View>

      <Animated.View entering={enter(4)} className="mt-2">
        <Button label="Done" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

type NutritionSummarySheetProps = { visible: boolean; onClose: () => void; saved: SavedMeal[] };

// Combined macros of every saved meal (at its saved servings), what the mix
// leans toward, and which meal leads each macro. Opened from the Saved
// tab's NutritionSummaryCard.
export function NutritionSummarySheet({ visible, onClose, saved }: NutritionSummarySheetProps) {
  // Bumped on every open, so reopening replays the opening sequence.
  const [openCount, setOpenCount] = useState(0);
  useEffect(() => {
    if (visible) setOpenCount((n) => n + 1);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.85}>
      <SummaryBody key={openCount} saved={saved} onClose={onClose} />
    </BottomSheet>
  );
}
