import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useSavedMealPlan } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import { SLOT_LABELS, upNextSlot } from "@/frontend/features/meal-planner/utils/generatePlan";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const PHOTO = 36;
// How far each of today's photos tucks under the one before it.
const OVERLAP = 12;

// Profile, under the header, while a plan runs today: today's three meal
// photos fanned, "Your plan this week", which day of the plan and the meal
// that's up next. The same plan as Home's "Today's plan" card, and shown
// when that card is (Free plans only open day 1). Tap for the plan, on
// today.
export function MealPlanBanner() {
  const isPro = useIsPro();
  const { loading } = useSavedMealPlan();
  const plan = usePlannerStore((s) => s.plan);

  const dayIndex = plan ? plan.days.findIndex((d) => sameDay(d.date, new Date())) : -1;
  if (loading || !plan || dayIndex < 0 || (!isPro && dayIndex > 0)) return null;

  const day = plan.days[dayIndex];
  const next = day.meals.find((m) => m.slot === upNextSlot()) ?? day.meals[0];
  const upNext = next.slot === "dinner" ? "Tonight" : SLOT_LABELS[next.slot];

  return (
    <Animated.View entering={FadeIn.duration(260)} className="px-5 pt-4">
      <Pressable
        onPress={() => router.push({ pathname: "/meal-planner", params: { day: String(dayIndex) } })}
        accessibilityRole="button"
        accessibilityLabel={`Your plan this week, day ${dayIndex + 1} of ${plan.days.length}. ${upNext}: ${next.meal.name}. Open your meal plan`}
        className="flex-row items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-3.5 py-3 active:opacity-80"
      >
        <View className="flex-row">
          {day.meals.map(({ slot, meal }, i) => (
            <View
              key={slot}
              style={{ width: PHOTO, height: PHOTO, marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: day.meals.length - i }}
              className="overflow-hidden rounded-full border-2 border-white bg-white"
            >
              <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
          ))}
        </View>
        <View className="flex-1">
          <Text className="font-inter-bold text-body text-ink-emphasis">
            Your plan this week<Text className="text-accent">.</Text>
          </Text>
          <Text numberOfLines={1} className="mt-0.5 font-inter-regular text-small text-ink-subtle">
            Day {dayIndex + 1} of {plan.days.length} · {upNext}: <Text className="font-inter-semibold text-ink-emphasis">{next.meal.name}</Text>
          </Text>
        </View>
        <ChevronRight color={colors.ink.subtle} size={18} />
      </Pressable>
    </Animated.View>
  );
}
