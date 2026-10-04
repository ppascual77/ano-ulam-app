import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInRight, FadeInUp } from "react-native-reanimated";
import { ArrowLeft, MoreHorizontal, Pencil } from "lucide-react-native";
import { AppText, Avatar, Button, Dropdown, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { PLAN_WITH_REAL_MEALS_ONLY, usePlannerPool } from "../hooks/usePlannerPool";
import { PLAN_DAYS, formatPeso, generatePlan, monthDay, regenerateDay, swapOptions } from "../utils/generatePlan";
import type { MealSlot } from "../mock/plannerMeals";
import { BudgetInput, MacroGoalCard, ServingStepper, parseBudget } from "../components/PlannerInputs";
import { MacroGoalSheet } from "../components/MacroGoalSheet";
import { GeneratingView } from "../components/GeneratingView";
import { DateSelector, DayActions, HeroCarousel, MealListRow, SummaryRow, useMeasuredWidth } from "../components/PlanParts";
import { LockedDaySheet, SwapMealSheet } from "../components/PlannerSheets";

// Meal Planner (test build of the flow): setup (budget, people, optional
// macro goal) -> a short timed "Planning your week" checklist -> a 5-day
// plan from today. Free users get day 1; days 2-5 are locked, and tapping
// them (or a day action) opens a light upgrade sheet whose "Unlock
// Premium" is a mock unlock.
// No Grocery List yet.
const MOCK_NAME = "Patrick";


export default function MealPlannerScreen() {
  const store = usePlannerStore();
  const { pool, isLoading: poolLoading } = usePlannerPool();
  const { session } = useAuth();
  const meta = session?.user.user_metadata ?? {};
  // The signed-in user's name; without a session (dev on a device), the
  // same mock name Home's header uses.
  const fullName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? MOCK_NAME;
  const firstName = fullName.split(" ")[0];
  const avatarUrl = (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined);

  const [macroSheetOpen, setMacroSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  // Which of the day's meals is in the hero (and highlighted in the list).
  const [selectedMeal, setSelectedMeal] = useState(0);
  const hero = useMeasuredWidth();
  const selectDay = (index: number) => {
    setSelectedDay(index);
    setSelectedMeal(0);
  };
  const [lockedOpen, setLockedOpen] = useState(false);
  const [swap, setSwap] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [localDetail, setLocalDetail] = useState<MealType | null>(null);
  const detail = useMealDetail();
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ id: Date.now(), message, tone });

  const budget = parseBudget(store.budget);
  const plan = store.plan;

  const build = () => {
    store.setPlan(
      generatePlan({ pool, budget, servings: store.servings, targets: store.targets, ignoreBudget: PLAN_WITH_REAL_MEALS_ONLY }),
    );
    selectDay(0);
    store.setStage("generating");
  };

  // Mock meals have no recipe page behind them: show what's on the card.
  const viewRecipe = (meal: MealType) => {
    if (meal.id?.startsWith("planner-")) setLocalDetail(meal);
    else detail.open(meal.id);
  };

  const regenerate = () => {
    if (!plan) return;
    const meals = regenerateDay(pool, plan, selectedDay, PLAN_WITH_REAL_MEALS_ONLY);
    if (!meals) return showToast("No other meals fit this day's budget", "error");
    store.replaceDay(selectedDay, meals);
    showToast("New meals for this day");
  };

  const unlock = () => {
    store.setPremium(true);
    setLockedOpen(false);
    showToast("Premium unlocked (test)");
  };


  return (
    <Screen edges={["top"]} padded={false} dismissKeyboardOnTap={false}>
      {store.stage === "setup" && (
        <Animated.View key="setup" entering={FadeInUp.duration(250)} className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-9 pb-10 pt-2">
            {/* Same type and spacing as Home's header (features/home/components/Header):
                36px from the left like Home's (28 + ml-2), and -mr-2 keeps the avatar
                28px from the right, where Home's sits, outside the cards' wider padding. */}
            <View className="-mr-2 flex-row items-center justify-between">
              <View>
                <AppText variant="title">
                  Hello, <Text className="font-inter-bold text-primary">{firstName}</Text>
                </AppText>
                <AppText variant="heading">Let's plan your week</AppText>
              </View>
              <View className="flex-row items-center gap-2">
                <Avatar name={fullName} imageUri={avatarUrl} size={48} />
              </View>
            </View>

            <View className="items-center gap-3 py-2">
              {/* Reuses onboarding's meal-planning illustration until the
                  planner's own hero asset arrives. */}
              <Image source={require("@/assets/onboarding/slide-3.gif")} style={{ width: 180, height: 174 }} contentFit="contain" />
              <Text className="max-w-[280px] text-center font-inter-regular text-body text-web-ink-body">
                Tell us a few details and we'll plan your week for you.
              </Text>
            </View>

            <BudgetInput value={store.budget} onChange={store.setBudget} />
            <ServingStepper value={store.servings} onChange={store.setServings} />
            <MacroGoalCard targets={store.targets} goal={store.goal} onEnable={() => setMacroSheetOpen(true)} onEdit={() => setMacroSheetOpen(true)} />

            <View className="mt-2">
              <Button label="Continue" onPress={build} disabled={budget <= 0 || poolLoading} />
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {store.stage === "generating" && (
        <Animated.View key="generating" entering={FadeIn.duration(250)} className="flex-1">
          <GeneratingView
            budgetLabel={formatPeso(budget)}
            hasMacros={!!store.targets}
            onBack={() => store.setStage("setup")}
            onDone={() => store.setStage(plan ? "plan" : "error")}
            failed={!plan}
          />
        </Animated.View>
      )}

      {store.stage === "error" && (
        <Animated.View key="error" entering={FadeIn.duration(250)} className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center font-inter-bold text-heading text-web-ink">Couldn't build your plan</Text>
          <Text className="text-center font-inter-regular text-body text-web-ink-muted">
            We couldn't find enough meals that fit your preferences and budget.
          </Text>
          <View className="mt-3 w-full">
            <Button label="Try Again" onPress={() => store.setStage("setup")} />
          </View>
        </Animated.View>
      )}

      {store.stage === "plan" && plan && (
        <Animated.View key="plan" entering={FadeInUp.duration(300)} className="flex-1">
          <View className="flex-row items-center px-5 pb-3 pt-2">
            <Pressable onPress={() => store.setStage("setup")} hitSlop={10} accessibilityLabel="Back to setup" className="w-16">
              <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
            </Pressable>
            <View className="flex-1 items-center">
              <Text className="font-inter-bold text-subheading text-web-ink">Your 5-Day Meal Plan</Text>
              <Text className="font-inter-regular text-small text-web-ink-muted">
                {monthDay(plan.days[0].date)} – {monthDay(plan.days[plan.days.length - 1].date)}
              </Text>
            </View>
            <View className="w-16 flex-row items-center justify-end">
              <Dropdown
                trigger={
                  <View className="p-1">
                    <MoreHorizontal color={colors.webInk.DEFAULT} size={20} />
                  </View>
                }
                items={[
                  {
                    label: "Edit plan details",
                    icon: <Pencil color={colors.webInk.muted} size={14} />,
                    onPress: () => store.setStage("setup"),
                  },
                ]}
              />
            </View>
          </View>

          <DateSelector plan={plan} selected={selectedDay} isPremium={store.isPremium} onSelect={selectDay} onLocked={() => setLockedOpen(true)} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10 pt-4">
            <SummaryRow plan={plan} day={plan.days[selectedDay]} />

            {/* Keyed by day: switching days slides the new day in. */}
            <Animated.View key={selectedDay} entering={FadeInRight.duration(220)} className="gap-4" onLayout={hero.onLayout}>
              {hero.width > 0 && (
                <HeroCarousel
                  day={plan.days[selectedDay]}
                  servings={plan.servings}
                  dayIndex={selectedDay}
                  width={hero.width}
                  selected={selectedMeal}
                  onChange={setSelectedMeal}
                  onOpen={(item) => viewRecipe(item.meal)}
                />
              )}

              <View className="gap-2">
                {plan.days[selectedDay].meals.map((item, i) => (
                  <MealListRow
                    key={item.slot}
                    item={item}
                    active={i === selectedMeal}
                    servings={plan.servings}
                    // First tap brings it into the hero; tapping the one
                    // already there opens its recipe.
                    onPress={() => (i === selectedMeal ? viewRecipe(item.meal) : setSelectedMeal(i))}
                  />
                ))}
              </View>
            </Animated.View>

            <DayActions
              locked={!store.isPremium}
              onRegenerate={() => (store.isPremium ? regenerate() : setLockedOpen(true))}
              onSwap={() =>
                store.isPremium
                  ? setSwap({ dayIndex: selectedDay, slot: plan.days[selectedDay].meals[selectedMeal].slot })
                  : setLockedOpen(true)
              }
              onEdit={() => (store.isPremium ? showToast("Editing a day is coming soon") : setLockedOpen(true))}
            />
          </ScrollView>
        </Animated.View>
      )}

      <MacroGoalSheet
        visible={macroSheetOpen}
        initialTargets={store.targets}
        initialGoal={store.goal}
        servings={store.servings}
        onClose={() => setMacroSheetOpen(false)}
        onConfirm={(targets, goal) => {
          store.setTargets(targets, goal);
          setMacroSheetOpen(false);
        }}
        onTurnOff={
          store.targets
            ? () => {
                store.setTargets(null);
                setMacroSheetOpen(false);
              }
            : undefined
        }
      />

      <LockedDaySheet visible={lockedOpen} lockedDays={PLAN_DAYS - 1} onClose={() => setLockedOpen(false)} onUnlock={unlock} />

      <SwapMealSheet
        slot={swap?.slot ?? null}
        options={plan && swap ? swapOptions(pool, plan, swap.dayIndex, swap.slot, PLAN_WITH_REAL_MEALS_ONLY) : []}
        showMacros={!!plan?.targets}
        onClose={() => setSwap(null)}
        onSwap={(meal) => {
          if (!swap) return;
          store.swapMeal(swap.dayIndex, swap.slot, meal);
          setSwap(null);
          showToast("Meal swapped");
        }}
      />

      <MealDetailSheet meal={localDetail} onClose={() => setLocalDetail(null)} />
      <MealDetailSheet meal={detail.meal} onClose={detail.close} />

      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
