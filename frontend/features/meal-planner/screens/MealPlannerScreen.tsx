import { useProStore } from "@/frontend/core/pro/store/useProStore";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInRight, FadeInUp } from "react-native-reanimated";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react-native";
import { AppText, Button, ConfirmSheet, LandingTitle, LoadingState, Screen, Toast, usePageIntro, type ToastState } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useDisplayName } from "@/frontend/features/auth/hooks/useDisplayName";
import { usePlannerStore } from "../store/usePlannerStore";
import { usePlannerPool } from "../hooks/usePlannerPool";
import { useSavedMealPlan } from "../hooks/useSavedMealPlan";
import { usePlanGroceryList } from "@/frontend/core/grocery/hooks/usePlanGroceryList";
import { useSavedGroceryList } from "@/frontend/core/grocery/hooks/useSavedGroceryList";
import { FullGroceryListSheet } from "@/frontend/core/grocery/components/FullGroceryListSheet";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { PLAN_DAYS, formatPeso, generatePlan, monthDay, regenerateDay, swapOptions, type MealPlan, type MealSlot } from "../utils/generatePlan";
import { targetsFromGoals } from "../utils/macros";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { BudgetInput, MacroGoalCard, ServingStepper, parseBudget } from "../components/PlannerInputs";
import { MacroGoalSheet } from "../components/MacroGoalSheet";
import { GeneratingView } from "../components/GeneratingView";
import { MealPlannerIntro } from "../components/MealPlannerIntro";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIntroOnce } from "@/frontend/core/preferences/store/useSeenIntrosStore";
import { DateSelector, DayActions, GroceryListButton, HeroCarousel, MealListRow, SummaryRow, useMeasuredWidth } from "../components/PlanParts";
import { LockedDaySheet, SwapMealSheet } from "../components/PlannerSheets";

// Meal Planner: setup (budget, people, optional macro goal) -> a short
// timed "Planning your week" checklist -> a 5-day plan from today, from the
// real catalog within budget. The plan is saved to the account and opens
// again until it ends (useSavedMealPlan). Free users get day 1; days 2-5
// are locked, and tapping them (or a day action) opens a light upgrade
// sheet, which leads to the full Pro page.

// Plays the "one budget, seven days" intro on opening the planner (setup
// stage only: that's where the "Let's plan your week." header is).
// TODO: gate this behind a first-time-user flag (the auto tour).
const SHOW_INTRO = true;


export default function MealPlannerScreen() {
  const store = usePlannerStore();
  const isPro = useProStore((s) => s.isPro);
  const { pool, isLoading: poolLoading } = usePlannerPool();
  const savedPlan = useSavedMealPlan();
  const { session } = useAuth();
  // "Hello, <first name>!", or just "Hello!" for a guest.
  const { firstName } = useDisplayName();
  // The intro's dot lands as the period of "Let's plan your week.".
  // Never with Reduce motion on (Settings, or the phone's own setting).
  const reduceMotion = useReduceMotion();
  const introOnce = useIntroOnce("meal-planner");
  const intro = usePageIntro({
    enabled: SHOW_INTRO && !reduceMotion && store.stage === "setup" && !savedPlan.loading && introOnce.due,
    onFinish: introOnce.markSeen,
  });

  const [macroSheetOpen, setMacroSheetOpen] = useState(false);
  // Pro: the nutrition goals from Settings, offered as the macro goal.
  const nutritionGoals = useNutritionGoals();
  // Pro: 5 or 7 days per new plan (Settings); everyone else 5.
  const { prefs } = usePreferences();
  const planLength = isPro ? prefs.planner_defaults.days : PLAN_DAYS;
  const goalTargets = useMemo(() => (nutritionGoals ? targetsFromGoals(nutritionGoals) : null), [nutritionGoals]);
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
  const detail = useMealDetail();
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ id: Date.now(), message, tone });

  const budget = parseBudget(store.budget);
  const plan = store.plan;
  // The grocery list covers the days you can see: the whole week for
  // Premium, today for Free. Fetched while the plan is on screen, so it's
  // ready when the sheet opens.
  const shownDays = plan?.days.length ?? planLength;
  const groceryDays = useMemo(() => (isPro ? Array.from({ length: shownDays }, (_, i) => i) : [0]), [isPro, shownDays]);
  const grocery = usePlanGroceryList(plan, groceryDays, store.stage === "plan", session?.user.id ?? null);
  // The sheet's other tab: the saved-meals list (same as Profile's).
  const savedGrocery = useSavedGroceryList(session?.user.id ?? null);
  const { data: pantry = [] } = usePantry();

  // Saves the plan as it now is in the store (after any change). If that
  // fails it stays on screen for this visit.
  const persist = async (next: MealPlan | null = usePlannerStore.getState().plan) => {
    if (!next) return;
    if (!(await savedPlan.save(next, usePlannerStore.getState().goal))) {
      showToast("Couldn't save your plan. Check your connection.", "error");
    }
  };

  // seed: a fresh one from "Regenerate", for a different plan.
  const build = (seed = 0) => {
    const next = generatePlan({ pool, budget, servings: store.servings, targets: store.targets, seed, length: planLength });
    store.setPlan(next);
    selectDay(0);
    store.setStage("generating");
    if (next) {
      // A new plan starts with a fresh grocery list.
      void grocery.reset();
      void persist(next);
    }
  };

  const viewRecipe = (meal: MealPlan["days"][number]["meals"][number]["meal"]) => detail.open(meal.id);

  const regenerate = () => {
    if (!plan) return;
    const meals = regenerateDay(pool, plan, selectedDay);
    if (!meals) return showToast("No other meals fit this day's budget", "error");
    store.replaceDay(selectedDay, meals);
    void persist();
    showToast("New meals for this day");
  };



  return (
    <Screen edges={["top"]} padded={false} dismissKeyboardOnTap={false}>
      {/* Opened from Home's "Plan your week" card (no longer a tab). */}
      <View className="px-5 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" className="h-9 w-9 justify-center">
          <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
        </Pressable>
      </View>
      {store.stage === "setup" && savedPlan.loading && (
        <View className="flex-1 justify-center">
          <LoadingState />
        </View>
      )}

      {store.stage === "setup" && !savedPlan.loading && (
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
                {firstName ? (
                  <>
                    Hello, <Text className="font-inter-semibold text-primary">{firstName}</Text>!
                  </>
                ) : (
                  "Hello!"
                )}{" "}
                Meals and a grocery list for 7
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
            <MacroGoalCard
              targets={store.targets}
              goal={store.goal}
              onEnable={() => setMacroSheetOpen(true)}
              onEdit={() => setMacroSheetOpen(true)}
              goalTargets={goalTargets}
              onUseGoals={() => goalTargets && store.setTargets(goalTargets)}
            />

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
            days={planLength}
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
              <Text className="font-inter-bold text-subheading text-web-ink">Your {shownDays}-Day Meal Plan</Text>
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

          <DateSelector plan={plan} selected={selectedDay} isPremium={isPro} onSelect={selectDay} onLocked={() => setLockedOpen(true)} />

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
              locked={!isPro}
              onRegenerate={() => (isPro ? regenerate() : setLockedOpen(true))}
              onSwap={() =>
                isPro
                  ? setSwap({ dayIndex: selectedDay, slot: plan.days[selectedDay].meals[selectedMeal].slot })
                  : setLockedOpen(true)
              }
              onEdit={() => (isPro ? showToast("Editing a day is coming soon") : setLockedOpen(true))}
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
          void grocery.flush();
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

      <LockedDaySheet visible={lockedOpen} lockedDays={shownDays - 1} onClose={() => setLockedOpen(false)} onOpenPro={() => router.push("/pro")} />

      <SwapMealSheet
        slot={swap?.slot ?? null}
        options={plan && swap ? swapOptions(pool, plan, swap.dayIndex, swap.slot) : []}
        showMacros={!!plan?.targets}
        onClose={() => setSwap(null)}
        onSwap={(meal) => {
          if (!swap) return;
          store.swapMeal(swap.dayIndex, swap.slot, meal);
          void persist();
          setSwap(null);
          showToast("Meal swapped");
        }}
      />

      <MealDetailSheet meal={detail.meal} onClose={detail.close} />

      <Toast toast={toast} onHide={() => setToast(null)} />
      {intro.showing && <MealPlannerIntro key={intro.run} active={intro.active} targetRef={intro.targetRef} onDone={intro.finish} />}
    </Screen>
  );
}
