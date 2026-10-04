import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";
import { ArrowLeftRight, BookOpen, ChevronRight, Crown, Droplets, Dumbbell, Lightbulb, Lock, Moon, Sun, UtensilsCrossed, Wheat, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { MacroTargets } from "../utils/macros";
import type { MealSlot } from "../mock/plannerMeals";
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

// Five equal day pills. Free users see days 2-5 with a lock.
export function DateSelector({ plan, selected, isPremium, onSelect, onLocked }: DateSelectorProps) {
  return (
    <View className="flex-row gap-1.5 px-5">
      {plan.days.map((day, i) => {
        const locked = !isPremium && i > 0;
        const active = i === selected;
        return (
          <Pressable
            key={day.date.toISOString()}
            onPress={() => (locked ? onLocked() : onSelect(i))}
            accessibilityState={{ selected: active }}
            accessibilityLabel={locked ? `${dayLabel(day.date, i)}, locked` : dayLabel(day.date, i)}
            className={`flex-1 items-center rounded-xl border py-2 ${active ? "border-brand-green bg-brand-green/10" : "border-web-divider bg-white"}`}
          >
            <View className="flex-row items-center gap-1">
              <Text className={`font-inter-semibold text-small ${locked ? "text-web-ink-muted" : "text-web-ink"}`}>{dayLabel(day.date, i)}</Text>
              {locked && <Lock color={colors.webInk.muted} size={10} />}
            </View>
            <Text className="mt-0.5 font-inter-regular text-sub text-web-ink-muted">{monthDay(day.date)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Free: upgrade prompts -------------------------------------------------------

// Orange banner above the day: the soft way in to Premium.
export function UpgradeBanner({ onPress }: { onPress: () => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-brand-orange/10 p-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/20">
        <Crown color={colors.brandOrange} size={20} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-small text-web-ink">Unlock your 5-day meal plan</Text>
        <Text className="mt-0.5 font-inter-regular text-sub leading-4 text-web-ink-body">Get 4 more days of personalized meals, swaps and more.</Text>
      </View>
      <Pressable onPress={onPress} className="rounded-full bg-brand-orange px-4 py-2 active:opacity-80">
        <Text className="font-inter-semibold text-small text-white">Upgrade</Text>
      </Pressable>
    </View>
  );
}

// Card under the day's meals.
export function RestOfWeekCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-web-divider bg-white p-4 active:bg-web-divider/40">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-notice-bg">
        <Lightbulb color={colors.notice.icon} size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-web-ink">Want to see the rest of your week?</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">Unlock 4 more days and the ability to customize your plan.</Text>
      </View>
      <ChevronRight color={colors.webInk.muted} size={18} />
    </Pressable>
  );
}

// ---- Macro chips / summary ----------------------------------------------------

const MACROS: { key: "protein" | "carbs" | "fats"; letter: string; label: string; Icon: LucideIcon; color: string; tint: string; text: string }[] = [
  { key: "protein", letter: "P", label: "Protein", Icon: Dumbbell, color: colors.macro.protein, tint: "bg-macro-protein/10", text: "text-macro-protein" },
  { key: "carbs", letter: "C", label: "Carbs", Icon: Wheat, color: colors.macro.carbs, tint: "bg-macro-carbs/10", text: "text-macro-carbs" },
  { key: "fats", letter: "F", label: "Fats", Icon: Droplets, color: colors.macro.fats, tint: "bg-macro-fats/10", text: "text-macro-fats" },
];

// Small ring: how much of the calorie target the day reaches.
function CalorieRing({ share }: { share: number }) {
  const size = 40;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.webDivider} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.brandOrange}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference * Math.min(1, share)} ${circumference}`}
      />
    </Svg>
  );
}

// Premium, macro goal on: the selected day's calories (ring vs target) and
// macros as small chips. Food first, so it stays a single compact row.
export function PremiumSummary({ day, servings, targets }: { day: PlanDay; servings: number; targets: MacroTargets }) {
  const totals = dayTotals(day, servings);
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-row items-center gap-2 pr-1">
        <CalorieRing share={totals.calories / targets.calories} />
        <View>
          <Text className="font-inter-bold text-body text-web-ink">{totals.calories.toLocaleString("en-PH")}</Text>
          <Text className="font-inter-regular text-sub text-web-ink-muted">kcal</Text>
        </View>
      </View>
      {MACROS.map(({ key, label, Icon, color, tint }) => (
        <View key={key} className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-web-divider px-2 py-1.5">
          <View className={`h-6 w-6 items-center justify-center rounded-full ${tint}`}>
            <Icon color={color} size={12} />
          </View>
          <View>
            <Text className="font-inter-bold text-small text-web-ink">{totals[key]}g</Text>
            <Text className="font-inter-regular text-sub text-web-ink-muted">{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// "Today · Sep 27" + meal count and kcal (or cost). With a macro goal and no
// summary row above (Free), small P / C / F tiles sit on the right.
export function DayHeader({ day, index, servings, targets, showMacroTiles }: { day: PlanDay; index: number; servings: number; targets: MacroTargets | null; showMacroTiles: boolean }) {
  const totals = dayTotals(day, servings);
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Text className="font-inter-bold text-subheading text-web-ink">
          {dayLabel(day.date, index)} · {monthDay(day.date)}
        </Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">
          {day.meals.length} meals · {targets ? `~${totals.calories.toLocaleString("en-PH")} kcal` : `~${formatPeso(totals.cost)}`}
        </Text>
      </View>
      {targets && showMacroTiles && (
        <View className="flex-row gap-1.5">
          {MACROS.map(({ key, letter, tint, text }) => (
            <View key={key} className={`items-center rounded-lg px-2 py-1 ${tint}`}>
              <Text className={`font-inter-bold text-sub ${text}`}>{letter}</Text>
              <Text className="font-inter-semibold text-sub text-web-ink">{totals[key]}g</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---- Meal row --------------------------------------------------------------------

const SLOT_ICONS: Record<MealSlot, { Icon: LucideIcon; color: string }> = {
  breakfast: { Icon: Sun, color: colors.brandOrange },
  lunch: { Icon: UtensilsCrossed, color: colors.brandGreen.DEFAULT },
  dinner: { Icon: Moon, color: colors.webInk.soft },
};

type PlanMealRowProps = {
  item: PlannedMeal;
  servings: number;
  showMacros: boolean;
  isPremium: boolean;
  onViewRecipe: () => void;
  onSwap: () => void;
};

function SmallAction({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 rounded-lg border border-web-divider px-2.5 py-1.5 active:bg-web-divider/50">
      <Icon color={colors.webInk.soft} size={13} />
      <Text className="font-inter-medium text-sub text-web-ink-soft">{label}</Text>
    </Pressable>
  );
}

// Photo on the left, slot + name + macros (or cost). Free: tap for the
// recipe. Premium: Swap meal and View recipe buttons.
export function PlanMealRow({ item, servings, showMacros, isPremium, onViewRecipe, onSwap }: PlanMealRowProps) {
  const { meal, slot } = item;
  const { Icon, color } = SLOT_ICONS[slot];
  return (
    <Pressable onPress={onViewRecipe} className="rounded-2xl border border-web-divider bg-white p-2.5 active:bg-web-divider/30">
      {/* Keyed by meal: a swap crossfades the new meal in. */}
      <Animated.View key={meal.id} entering={FadeIn.duration(250)} className="flex-row gap-3">
        <MealImage meal={meal} height={isPremium ? 104 : 84} width={isPremium ? 104 : 84} rounded="rounded-xl" />
        <View className="flex-1 justify-center gap-1">
          <View className="flex-row items-center gap-1.5">
            <Icon color={color} size={13} />
            <Text className="font-inter-medium text-sub text-web-ink-muted">{SLOT_LABELS[slot]}</Text>
          </View>
          <Text numberOfLines={2} className="font-inter-bold text-body text-web-ink">
            {meal.name}
          </Text>
          <Text className="font-inter-regular text-sub text-web-ink-muted">
            {showMacros
              ? `${meal.calories} kcal · ${meal.protein}g P · ${meal.carbs}g C · ${meal.fats}g F`
              : `~${formatPeso(perServing(meal) * servings)}${servings > 1 ? ` for ${servings}` : ""} · ${meal.calories} kcal`}
          </Text>
          {isPremium && (
            <View className="mt-1 flex-row gap-2">
              <SmallAction Icon={ArrowLeftRight} label="Swap meal" onPress={onSwap} />
              <SmallAction Icon={BookOpen} label="View recipe" onPress={onViewRecipe} />
            </View>
          )}
        </View>
        {!isPremium && (
          <View className="justify-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-web-divider">
              <ChevronRight color={colors.webInk.soft} size={16} />
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
