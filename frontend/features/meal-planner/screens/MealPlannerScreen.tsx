import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeInUp } from "react-native-reanimated";
import { ArrowLeft, MoreHorizontal, Pencil } from "lucide-react-native";
import { Avatar, Button, Dropdown, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { usePlannerPool } from "../hooks/usePlannerPool";
import { PLAN_DAYS, formatPeso, generatePlan, monthDay, swapOptions } from "../utils/generatePlan";
import type { MealSlot } from "../mock/plannerMeals";
import { BudgetInput, MacroGoalCard, ServingStepper, parseBudget } from "../components/PlannerInputs";
import { MacroGoalSheet } from "../components/MacroGoalSheet";
import { GeneratingView } from "../components/GeneratingView";
import { DateSelector, DayHeader, PlanMealRow, PremiumSummary, RestOfWeekCard, UpgradeBanner } from "../components/PlanParts";
import { LockedDaySheet, SwapMealSheet } from "../components/PlannerSheets";
import { ImagePlaceholder } from "../components/ImagePlaceholder";

// Meal Planner (test build of the flow): setup (budget, people, optional
// macro goal) -> a short timed "Planning your week" checklist -> a 5-day
// plan from today. Free users get day 1; days 2-5 and the upgrade prompts
// open a light upgrade sheet whose "Unlock Premium" is a mock unlock.
// No Grocery List yet.
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
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10 pt-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-inter-semibold text-subheading text-web-ink">
                  Hello{firstName ? ", " : "!"}
                  {firstName && <Text className="text-brand-green">{firstName}</Text>}
                </Text>
                <Text className="mt-0.5 font-inter-semibold text-body text-web-ink-soft">Let's plan your week</Text>
              </View>
              <View className="flex-row items-center gap-2">
                {devPill}
                <Avatar name={fullName ?? "Guest"} imageUri={avatarUrl} size={48} />
              </View>
            </View>

            <View className="items-center gap-3 py-2">
              <ImagePlaceholder kind="hero" height={130} width={170} rounded="rounded-3xl" />
              <Text className="max-w-[280px] text-center font-inter-regular text-body text-web-ink-body">
                Tell us a few details and we'll plan your week for you.
              </Text>
            </View>

            <BudgetInput value={store.budget} onChange={store.setBudget} />
            <ServingStepper value={store.servings} onChange={store.setServings} />
            <MacroGoalCard targets={store.targets} goal={store.goal} onEnable={() => setMacroSheetOpen(true)} onEdit={() => setMacroSheetOpen(true)} />

            <View className="mt-2">
              <Button label="Continue" onPress={build} disabled={budget <= 0} />
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
              <Text className="font-inter-bold text-subheading text-web-ink">{store.isPremium ? "Your 5-Day Meal Plan" : "Your Meal Plan"}</Text>
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

          <DateSelector plan={plan} selected={selectedDay} isPremium={store.isPremium} onSelect={setSelectedDay} onLocked={() => setLockedOpen(true)} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10 pt-4">
            {devPill && <View className="items-end">{devPill}</View>}
            {!store.isPremium && <UpgradeBanner onPress={() => setLockedOpen(true)} />}
            {store.isPremium && plan.targets && <PremiumSummary day={plan.days[selectedDay]} servings={plan.servings} targets={plan.targets} />}

            {/* Keyed by day: switching days slides the new day in. */}
            <Animated.View key={selectedDay} entering={FadeInRight.duration(220)} className="gap-3">
              <DayHeader day={plan.days[selectedDay]} index={selectedDay} servings={plan.servings} targets={plan.targets} showMacroTiles={!store.isPremium} />
              {plan.days[selectedDay].meals.map((item) => (
                <PlanMealRow
                  key={item.slot}
                  item={item}
                  servings={plan.servings}
                  showMacros={!!plan.targets}
                  isPremium={store.isPremium}
                  onViewRecipe={() => viewRecipe(item.meal)}
                  onSwap={() => setSwap({ dayIndex: selectedDay, slot: item.slot })}
                />
              ))}
            </Animated.View>

            {!store.isPremium && <RestOfWeekCard onPress={() => setLockedOpen(true)} />}
          </ScrollView>
        </Animated.View>
      )}

      <MacroGoalSheet
        visible={macroSheetOpen}
        initialTargets={store.targets}
        initialGoal={store.goal}
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
