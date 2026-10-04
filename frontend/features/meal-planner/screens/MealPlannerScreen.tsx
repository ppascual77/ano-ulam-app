import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeInUp } from "react-native-reanimated";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import { Avatar, Button, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { usePlannerPool } from "../hooks/usePlannerPool";
import { PLAN_DAYS, formatPeso, generatePlan, monthDay, swapOptions } from "../utils/generatePlan";
import type { MealSlot } from "../mock/plannerMeals";
import { BudgetInput, MacroGoalRow, ServingStepper, parseBudget } from "../components/PlannerInputs";
import { MacroGoalSheet } from "../components/MacroGoalSheet";
import { GeneratingView } from "../components/GeneratingView";
import { DateSelector, DayHeader, PlanMealCard, PlanSummary } from "../components/PlanParts";
import { LockedDaySheet, SwapMealSheet } from "../components/PlannerSheets";
import { ImagePlaceholder } from "../components/ImagePlaceholder";

// Meal Planner (test build of the flow): setup (budget, people, optional
// macro goal) -> a short timed "generating" checklist -> a 5-day plan from
// today. Free users get day 1; days 2-5 and Swap show a light upgrade
// sheet whose "Unlock Premium" is a mock unlock. No Grocery List yet.
export default function MealPlannerScreen() {
  const store = usePlannerStore();
  const { pool } = usePlannerPool();
  const { session } = useAuth();
  const meta = session?.user.user_metadata ?? {};
  const fullName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null;
  const firstName = fullName?.split(" ")[0] ?? null;
  const avatarUrl = (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined);

  const [macroSheetOpen, setMacroSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [swap, setSwap] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [localDetail, setLocalDetail] = useState<MealType | null>(null);
  const detail = useMealDetail();
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ id: Date.now(), message, tone });

  const budget = parseBudget(store.budget);
  const plan = store.plan;

  const build = () => {
    store.setPlan(generatePlan({ pool, budget, servings: store.servings, targets: store.targets }));
    setSelectedDay(0);
    store.setStage("generating");
  };

  // Mock meals have no recipe page behind them: show what's on the card.
  const viewRecipe = (meal: MealType) => {
    if (meal.id?.startsWith("planner-")) setLocalDetail(meal);
    else detail.open(meal.id);
  };

  const unlock = () => {
    store.setPremium(true);
    setLockedOpen(false);
    showToast("Premium unlocked (test)");
  };

  const devPill = __DEV__ && (
    <Pressable onPress={() => store.setPremium(!store.isPremium)} className="rounded-full bg-web-ink/80 px-2 py-1">
      <Text className="font-inter-semibold text-sub text-white">DEV {store.isPremium ? "premium" : "free"}</Text>
    </Pressable>
  );

  return (
    <Screen edges={["top"]} padded={false} dismissKeyboardOnTap={false}>
      {store.stage === "setup" && (
        <Animated.View key="setup" entering={FadeInUp.duration(250)} className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerClassName="gap-6 px-6 pb-10 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-medium text-body text-web-ink-muted">
                {firstName ? (
                  <>
                    Hello, <Text className="font-inter-bold text-primary">{firstName}</Text>
                  </>
                ) : (
                  "Hello!"
                )}
              </Text>
              <View className="flex-row items-center gap-2">
                {devPill}
                <Avatar name={fullName ?? "Guest"} imageUri={avatarUrl} size={40} />
              </View>
            </View>

            <View>
              <Text className="font-inter-bold text-heading text-web-ink">Let's plan your week</Text>
              <Text className="mt-1 font-inter-regular text-body text-web-ink-muted">
                Tell us a few details and we'll plan your meals around them.
              </Text>
            </View>

            <ImagePlaceholder kind="hero" height={150} />

            <BudgetInput value={store.budget} onChange={store.setBudget} />
            <ServingStepper value={store.servings} onChange={store.setServings} />
            <MacroGoalRow
              targets={store.targets}
              onToggle={(on) => (on ? setMacroSheetOpen(true) : store.setTargets(null))}
              onEdit={() => setMacroSheetOpen(true)}
            />

            <Button
              label="Build My 5-Day Plan"
              icon={<Sparkles color={colors.white} size={18} />}
              iconPosition="right"
              onPress={build}
              disabled={budget <= 0}
            />
          </ScrollView>
        </Animated.View>
      )}

      {store.stage === "generating" && (
        <Animated.View key="generating" entering={FadeIn.duration(250)} className="flex-1">
          <GeneratingView
            budgetLabel={formatPeso(budget)}
            hasMacros={!!store.targets}
            onDone={() => store.setStage(plan ? "plan" : "error")}
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
          <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
            <Pressable onPress={() => store.setStage("setup")} hitSlop={10} accessibilityLabel="Back to setup">
              <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
            </Pressable>
            <View className="flex-1">
              <Text className="font-inter-bold text-subheading text-web-ink">Your Meal Plan</Text>
              <Text className="font-inter-regular text-small text-web-ink-muted">
                {monthDay(plan.days[0].date)} – {monthDay(plan.days[plan.days.length - 1].date)}
              </Text>
            </View>
            {devPill}
          </View>

          <DateSelector
            plan={plan}
            selected={selectedDay}
            isPremium={store.isPremium}
            onSelect={setSelectedDay}
            onLocked={() => setLockedOpen(true)}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 px-5 pb-10 pt-5">
            {store.isPremium && <PlanSummary plan={plan} />}

            {/* Keyed by day: switching days slides the new day in. */}
            <Animated.View key={selectedDay} entering={FadeInRight.duration(220)} className="gap-4">
              <DayHeader day={plan.days[selectedDay]} index={selectedDay} servings={plan.servings} targets={plan.targets} />
              {plan.days[selectedDay].meals.map((item) => (
                <PlanMealCard
                  key={item.slot}
                  item={item}
                  servings={plan.servings}
                  showMacros={!!plan.targets}
                  isPremium={store.isPremium}
                  onViewRecipe={() => viewRecipe(item.meal)}
                  onSwap={() => (store.isPremium ? setSwap({ dayIndex: selectedDay, slot: item.slot }) : setLockedOpen(true))}
                />
              ))}
            </Animated.View>
          </ScrollView>
        </Animated.View>
      )}

      <MacroGoalSheet
        visible={macroSheetOpen}
        initialTargets={store.targets}
        onClose={() => setMacroSheetOpen(false)}
        onConfirm={(targets) => {
          store.setTargets(targets);
          setMacroSheetOpen(false);
        }}
      />

      <LockedDaySheet visible={lockedOpen} lockedDays={PLAN_DAYS - 1} onClose={() => setLockedOpen(false)} onUnlock={unlock} />

      <SwapMealSheet
        slot={swap?.slot ?? null}
        options={plan && swap ? swapOptions(pool, plan, swap.dayIndex, swap.slot) : []}
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
