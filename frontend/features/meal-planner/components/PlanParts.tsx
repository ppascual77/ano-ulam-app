import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ArrowLeftRight, BookOpen, Lock } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { MacroTargets } from "../utils/macros";
import { SLOT_LABELS, dayLabel, dayTotals, formatPeso, monthDay, perServing, type MealPlan, type PlanDay, type PlannedMeal } from "../utils/generatePlan";
import { MealImage } from "./ImagePlaceholder";

// ---- Date selector -----------------------------------------------------------

type DateSelectorProps = {
  plan: MealPlan;
  selected: number;
  isPremium: boolean;
  onSelect: (index: number) => void;
  /** A Free user tapping day 2-5. */
  onLocked: () => void;
};

// Horizontal day pills. Free users see days 2-5 with a lock.
export function DateSelector({ plan, selected, isPremium, onSelect, onLocked }: DateSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5">
      {plan.days.map((day, i) => {
        const locked = !isPremium && i > 0;
        const active = i === selected;
        return (
          <Pressable
            key={day.date.toISOString()}
            onPress={() => (locked ? onLocked() : onSelect(i))}
            accessibilityState={{ selected: active }}
            className={`w-[68px] items-center rounded-2xl border py-2.5 ${
              active ? "border-brand-green bg-brand-green" : "border-web-divider bg-white"
            }`}
          >
            <Text className={`font-inter-semibold text-small ${active ? "text-white" : locked ? "text-web-ink-muted" : "text-web-ink"}`}>
              {dayLabel(day.date, i)}
            </Text>
            <Text className={`mt-0.5 font-inter-regular text-sub ${active ? "text-white/80" : "text-web-ink-muted"}`}>
              {monthDay(day.date)}
            </Text>
            {locked && (
              <View className="mt-1">
                <Lock color={colors.webInk.muted} size={11} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---- Summary / day header ------------------------------------------------------

function Chip({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-web-divider/70 py-2">
      <Text className="font-inter-bold text-body text-web-ink">{value}</Text>
      <Text className="font-inter-regular text-sub text-web-ink-muted">{label}</Text>
    </View>
  );
}

// Premium only: the week at a glance. Calories/macros only with a macro goal;
// otherwise cost, so the screen stays about food, not tracking.
export function PlanSummary({ plan }: { plan: MealPlan }) {
  const totals = plan.days.map((day) => dayTotals(day, plan.servings));
  const avg = (key: "calories" | "protein" | "carbs" | "fats") => Math.round(totals.reduce((s, t) => s + t[key], 0) / totals.length);
  const weekCost = totals.reduce((s, t) => s + t.cost, 0);
  return (
    <View className="gap-2">
      <Text className="font-inter-semibold text-small text-web-ink-muted">{plan.targets ? "Daily average" : "This week"}</Text>
      <View className="flex-row gap-2">
        {plan.targets ? (
          <>
            <Chip value={avg("calories").toLocaleString("en-PH")} label="kcal" />
            <Chip value={`${avg("protein")}g`} label="Protein" />
            <Chip value={`${avg("carbs")}g`} label="Carbs" />
            <Chip value={`${avg("fats")}g`} label="Fat" />
          </>
        ) : (
          <>
            <Chip value={`~${formatPeso(weekCost)}`} label={`of ${formatPeso(plan.budget)}`} />
            <Chip value={`~${formatPeso(weekCost / plan.days.length)}`} label="per day" />
            <Chip value={String(plan.days.length * 3)} label="meals" />
          </>
        )}
      </View>
    </View>
  );
}

// "Today · Sep 27", then the day's cost or (with a macro goal) its macros.
export function DayHeader({ day, index, servings, targets }: { day: PlanDay; index: number; servings: number; targets: MacroTargets | null }) {
  const totals = dayTotals(day, servings);
  return (
    <View className="gap-3">
      <View>
        <Text className="font-inter-bold text-subheading text-web-ink">
          {dayLabel(day.date, index)} · {monthDay(day.date)}
        </Text>
        <Text className="mt-0.5 font-inter-regular text-body text-web-ink-muted">
          {day.meals.length} meals · {targets ? `~${totals.calories.toLocaleString("en-PH")} kcal` : `~${formatPeso(totals.cost)}`}
        </Text>
      </View>
      {targets && (
        <View className="flex-row gap-2">
          <Chip value={totals.calories.toLocaleString("en-PH")} label="kcal" />
          <Chip value={`${totals.protein}g`} label="Protein" />
          <Chip value={`${totals.carbs}g`} label="Carbs" />
          <Chip value={`${totals.fats}g`} label="Fat" />
        </View>
      )}
    </View>
  );
}

// ---- Meal card -------------------------------------------------------------------

type PlanMealCardProps = {
  item: PlannedMeal;
  servings: number;
  showMacros: boolean;
  isPremium: boolean;
  onViewRecipe: () => void;
  /** Premium: opens the swap sheet. Free: the upgrade sheet. */
  onSwap: () => void;
};

// Photo first, then the slot and name; macros only with a macro goal.
export function PlanMealCard({ item, servings, showMacros, isPremium, onViewRecipe, onSwap }: PlanMealCardProps) {
  const { meal, slot } = item;
  return (
    <View className="overflow-hidden rounded-3xl border border-web-divider bg-white">
      {/* Keyed by meal: a swap crossfades the new meal in. */}
      <Animated.View key={meal.id} entering={FadeIn.duration(250)}>
        <MealImage meal={meal} height={150} rounded="rounded-none" />
        <View className="gap-1 px-4 pt-3">
          <Text className="font-inter-semibold text-sub uppercase tracking-widest text-brand-green">{SLOT_LABELS[slot]}</Text>
          <Text numberOfLines={2} className="font-inter-bold text-subheading text-web-ink">
            {meal.name}
          </Text>
          <Text className="font-inter-regular text-small text-web-ink-muted">
            {showMacros
              ? `${meal.calories} kcal · ${meal.protein}g P · ${meal.carbs}g C · ${meal.fats}g F`
              : `~${formatPeso(perServing(meal) * servings)}${servings > 1 ? ` for ${servings}` : ""}`}
          </Text>
        </View>
      </Animated.View>

      <View className="mt-3 flex-row border-t border-web-divider">
        <Pressable onPress={onViewRecipe} className="flex-1 flex-row items-center justify-center gap-1.5 py-3 active:bg-web-divider/50">
          <BookOpen color={colors.brandGreen.DEFAULT} size={15} />
          <Text className="font-inter-semibold text-small text-brand-green">View Recipe</Text>
        </Pressable>
        <View className="w-px bg-web-divider" />
        <Pressable onPress={onSwap} className="flex-1 flex-row items-center justify-center gap-1.5 py-3 active:bg-web-divider/50">
          {isPremium ? <ArrowLeftRight color={colors.webInk.soft} size={15} /> : <Lock color={colors.webInk.muted} size={13} />}
          <Text className={`font-inter-semibold text-small ${isPremium ? "text-web-ink-soft" : "text-web-ink-muted"}`}>Swap meal</Text>
        </Pressable>
      </View>
    </View>
  );
}
