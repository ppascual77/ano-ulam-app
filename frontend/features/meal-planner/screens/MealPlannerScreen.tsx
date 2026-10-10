import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInRight, FadeInUp } from "react-native-reanimated";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react-native";
import { AppText, Button, ConfirmSheet, LandingTitle, Screen, Toast, usePageIntro, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { PLAN_WITH_REAL_MEALS_ONLY, usePlannerPool } from "../hooks/usePlannerPool";
import { usePlanGroceryList } from "@/frontend/core/grocery/hooks/usePlanGroceryList";
import { useSavedGroceryList } from "@/frontend/core/grocery/hooks/useSavedGroceryList";
import { FullGroceryListSheet } from "@/frontend/core/grocery/components/FullGroceryListSheet";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { PLAN_DAYS, formatPeso, generatePlan, monthDay, regenerateDay, swapOptions } from "../utils/generatePlan";
import type { MealSlot } from "../mock/plannerMeals";
import { BudgetInput, MacroGoalCard, ServingStepper, parseBudget } from "../components/PlannerInputs";
import { MacroGoalSheet } from "../components/MacroGoalSheet";
import { GeneratingView } from "../components/GeneratingView";
import { MealPlannerIntro } from "../components/MealPlannerIntro";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { DateSelector, DayActions, GroceryListButton, HeroCarousel, MealListRow, SummaryRow, useMeasuredWidth } from "../components/PlanParts";
import { LockedDaySheet, SwapMealSheet } from "../components/PlannerSheets";

// Meal Planner (test build of the flow): setup (budget, people, optional
// macro goal) -> a short timed "Planning your week" checklist -> a 5-day
// plan from today. Free users get day 1; days 2-5 are locked, and tapping
// them (or a day action) opens a light upgrade sheet whose "Unlock
// Premium" is a mock unlock.
// No Grocery List yet.
const MOCK_NAME = "Patrick";

// Plays the "one budget, seven days" intro on opening the planner (setup
// stage only: that's where the "Let's plan your week." header is).
// TODO: gate this behind a first-time-user flag (the auto tour).
const SHOW_INTRO = true;


export default function MealPlannerScreen() {
  const store = usePlannerStore();
  const { pool, isLoading: poolLoading } = usePlannerPool();
  const { session } = useAuth();
  const meta = session?.user.user_metadata ?? {};
  // The signed-in user's name; without a session (dev on a device), the
  // same mock name Home's header uses.
  const fullName = (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? MOCK_NAME;
  const firstName = fullName.split(" ")[0];
  // The intro's dot lands as the period of "Let's plan your week.".
  // Never with Reduce motion on (Settings, or the phone's own setting).
  const reduceMotion = useReduceMotion();
  const intro = usePageIntro({ enabled: SHOW_INTRO && !reduceMotion && store.stage === "setup" });

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
  const [groceryOpen, setGroceryOpen] = useState(false);
  // Header actions, each confirmed in a sheet first.
  const [confirm, setConfirm] = useState<"regenerate" | "edit" | null>(null);
  const confirmKind = useRef<"regenerate" | "edit" | null>(null);
  if (confirm) confirmKind.current = confirm;
  // What to do once the confirm sheet has finished closing (the loading
  // screen / setup shouldn't appear under a sheet still sliding away).
  const afterConfirm = useRef<(() => void) | null>(null);
  const [swap, setSwap] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [localDetail, setLocalDetail] = useState<MealType | null>(null);
  const detail = useMealDetail();
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ id: Date.now(), message, tone });

  const budget = parseBudget(store.budget);
  const plan = store.plan;
  // The grocery list covers the days you can see: the whole week for
  // Premium, today for Free. Fetched while the plan is on screen, so it's
  // ready when the sheet opens.
  const groceryDays = useMemo(() => (store.isPremium ? [0, 1, 2, 3, 4] : [0]), [store.isPremium]);
  const grocery = usePlanGroceryList(plan, groceryDays, store.stage === "plan");
  // The sheet's other tab: the saved-meals list (same as Profile's).
  const savedGrocery = useSavedGroceryList(session?.user.id ?? null);
  const { data: pantry = [] } = usePantry();

  // seed: a fresh one from "Regenerate", for a different plan.
  const build = (seed = 0) => {
    store.setPlan(
      generatePlan({ pool, budget, servings: store.servings, targets: store.targets, ignoreBudget: PLAN_WITH_REAL_MEALS_ONLY, seed }),
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
      {/* Opened from Home's "Plan your week" card (no longer a tab). */}
      <View className="px-5 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" className="h-9 w-9 justify-center">
          <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
      </View>
      {store.stage === "setup" && (
        <Animated.View key="setup" entering={FadeInUp.duration(250)} className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-9 pb-10 pt-2">
            {/* Same title style as "Price Watch." and "Browse." (28px from
                the edge like theirs, so -ml-2 past the cards' wider padding);
                its period is where the intro's dot lands. */}
            <View className="-ml-2">
              <LandingTitle dotRef={intro.targetRef} showDot={intro.landed}>
                Let&apos;s plan your week
              </LandingTitle>
              <AppText variant="caption">
                Hello, <Text className="font-inter-semibold text-primary">{firstName}</Text>! Meals and a grocery list for 7
                days, built around your budget.
              </AppText>
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
              <Button label="Continue" onPress={() => build()} disabled={budget <= 0 || poolLoading} />
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {store.stage === "generating" && (
        <Animated.View key="generating" entering={FadeIn.duration(250)} className="flex-1">
          <GeneratingView
            budgetLabel={formatPeso(budget)}
            meals={pool}
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
            <Pressable onPress={() => setConfirm("regenerate")} hitSlop={10} accessibilityLabel="Regenerate plan" className="w-16">
              <RefreshCw color={colors.webInk.DEFAULT} size={20} />
            </Pressable>
            <View className="flex-1 items-center">
              <Text className="font-inter-bold text-subheading text-web-ink">Your 5-Day Meal Plan</Text>
              <Text className="font-inter-regular text-small text-web-ink-muted">
                {monthDay(plan.days[0].date)} – {monthDay(plan.days[plan.days.length - 1].date)}
              </Text>
            </View>
            <View className="w-16 items-end">
              <Pressable onPress={() => setConfirm("edit")} hitSlop={10} accessibilityLabel="Edit plan details">
                <Pencil color={colors.webInk.DEFAULT} size={19} />
              </Pressable>
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
            <GroceryListButton onPress={() => setGroceryOpen(true)} />
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

      <ConfirmSheet
        visible={!!confirm}
        tone="primary"
        icon={
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-green/10">
            {confirmKind.current === "edit" ? (
              <Pencil color={colors.brandGreen.DEFAULT} size={20} />
            ) : (
              <RefreshCw color={colors.brandGreen.DEFAULT} size={20} />
            )}
          </View>
        }
        title={confirmKind.current === "edit" ? "Edit your plan details?" : "Regenerate your plan?"}
        body={
          confirmKind.current === "edit"
            ? "You'll go back to your budget, people and nutrition goal. Building again replaces this plan."
            : "We'll plan a fresh 5 days with the same budget and settings. Your current meals and swaps will be replaced."
        }
        confirmLabel={confirmKind.current === "edit" ? "Edit details" : "Regenerate"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          afterConfirm.current = confirm === "edit" ? () => store.setStage("setup") : () => build(Date.now() % 100000);
          setConfirm(null);
        }}
        onClosed={() => {
          afterConfirm.current?.();
          afterConfirm.current = null;
        }}
      />

      <FullGroceryListSheet
        visible={groceryOpen}
        onClose={() => {
          setGroceryOpen(false);
          void savedGrocery.flush();
        }}
        initialTab="plan"
        tabs={[
          {
            key: "plan",
            label: "Meal plan",
            items: grocery.items,
            total: grocery.total,
            isChecked: grocery.isChecked,
            onToggle: grocery.toggle,
            emptyText: "Your meal plan's ingredients will show up here.",
          },
          {
            key: "saved",
            label: "Saved meals",
            items: savedGrocery.items,
            total: savedGrocery.total,
            isChecked: savedGrocery.isChecked,
            onToggle: savedGrocery.toggle,
            emptyText: "Save home-cooked meals and their ingredients will show up here.",
          },
        ]}
        pantry={pantry}
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
      {intro.showing && <MealPlannerIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />}
    </Screen>
  );
}
