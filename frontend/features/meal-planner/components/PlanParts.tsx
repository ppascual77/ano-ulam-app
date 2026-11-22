import { ReactNode, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeftRight, ChevronRight, CookingPot, Cookie, Info, ShoppingCart, CloudSun, Moon, Sun, Droplets, Dumbbell, Flame, Lock, RefreshCw, Wheat, type LucideIcon } from "lucide-react-native";
import { SegmentedSwitch } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import type { MacroTargets } from "@/frontend/core/nutrition/macros";
import { FALLBACK_RICE_CUP, PLAN_DAYS, SLOTS, SLOT_LABELS, dayGoalGap, dayLabel, dayTotals, formatPeso, mealCost as costOfMeal, monthDay, riceCupsFor, type MealPlan, type PlanDay, type PlanRice, type PlannedMeal } from "../utils/generatePlan";
import { MealImage } from "./ImagePlaceholder";
import type { MealSlot } from "../utils/generatePlan";

// ---- Week strip ------------------------------------------------------------

type DateSelectorProps = {
  plan: MealPlan;
  selected: number;
  isPremium: boolean;
  onSelect: (index: number) => void;
  /** A Free user tapping a day after the first. */
  onLocked: () => void;
};

// One pill per day (5, or 7 for a Pro plan): the weekday, the date big, and
// a dot per planned meal. The selected day is solid green; Free users see
// every day after the first outlined with a lock. The pills drop in one
// after another when the plan appears.
export function DateSelector({ plan, selected, isPremium, onSelect, onLocked }: DateSelectorProps) {
  return (
    <View className={`flex-row px-5 ${plan.days.length > 5 ? "gap-1" : "gap-1.5"}`}>
      {plan.days.map((day, i) => {
        const locked = !isPremium && i > 0;
        const active = i === selected;
        return (
          <Animated.View key={day.date.toISOString()} entering={FadeInDown.delay(80 + i * 35).duration(300)} style={{ flex: 1 }}>
            <Pressable
              onPress={() => (locked ? onLocked() : onSelect(i))}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${dayLabel(day.date, i)}, ${monthDay(day.date)}${locked ? ", locked" : ""}`}
              className={`items-center rounded-2xl py-2 ${active ? "bg-primary" : locked ? "border border-ink-emphasis/10 bg-white" : "bg-mood-bg active:bg-tinted-bg"}`}
            >
              <Text
                numberOfLines={1}
                className={`font-inter-semibold text-sub uppercase tracking-wide ${active ? "text-white/75" : "text-ink-subtle"}`}
              >
                {dayLabel(day.date, i)}
              </Text>
              <Text className={`mt-1 font-inter-extrabold text-subheading ${active ? "text-white" : locked ? "text-web-ink-faint" : "text-ink-emphasis"}`}>
                {day.date.getDate()}
              </Text>
              <View className="mt-1 h-2 flex-row items-center gap-0.5">
                {locked ? (
                  <Lock color={colors.accent} size={9} strokeWidth={2.5} />
                ) : (
                  day.meals.map((m) => <View key={m.slot} className={`h-1 w-1 rounded-full ${active ? "bg-white" : "bg-primary/40"}`} />)
                )}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ---- Summary row -------------------------------------------------------------

const MACROS: { key: "protein" | "carbs" | "fats"; letter: string; label: string; Icon: LucideIcon; color: string; tint: string }[] = [
  { key: "protein", letter: "P", label: "Protein", Icon: Dumbbell, color: colors.macro.protein, tint: "bg-macro-protein/10" },
  { key: "carbs", letter: "C", label: "Carbs", Icon: Wheat, color: colors.macro.carbs, tint: "bg-macro-carbs/10" },
  { key: "fats", letter: "F", label: "Fats", Icon: Droplets, color: colors.macro.fats, tint: "bg-macro-fats/10" },
];

// Small donut split into parts (their share of the total), with a value and
// label in the middle. Used for the macro split (by calories) and the cost
// split (by meal).
function SplitDonut({ parts, centerValue, centerLabel }: { parts: { key: string; value: number; color: string }[]; centerValue: string; centerLabel: string }) {
  const size = 58;
  const stroke = 6;
  const gap = 3; // px of track between slices
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((sum, p) => sum + p.value, 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.webDivider} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          shown.map((p) => {
            const length = Math.max(0, (p.value / total) * circumference - gap);
            const dashOffset = -offset;
            offset += (p.value / total) * circumference;
            return (
              <Circle
                key={p.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={p.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
      </Svg>
      <Text className="font-inter-bold text-small text-web-ink">{centerValue}</Text>
      <Text className="-mt-0.5 font-inter-regular text-sub text-web-ink-muted">{centerLabel}</Text>
    </View>
  );
}

type SummaryStat = { key: string; label: string; value: string; color: string };

// The summary's shared shell: a heading row (title, and how the day compares
// to a goal), then one card with the donut and three dot-labelled stats.
// Macro and cost versions both render through this, so they match exactly.
function SummaryCard({ title, goal, donut, stats, note }: { title: string; goal: ReactNode; donut: ReactNode; stats: SummaryStat[]; note?: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-inter-semibold text-body text-web-ink">{title}</Text>
        <Text className="font-inter-regular text-small text-web-ink-muted">{goal}</Text>
      </View>
      <View className="flex-row items-center rounded-2xl border border-web-divider bg-white px-3 py-2.5">
        {donut}
        {stats.map(({ key, label, value, color }, i) => (
          <View key={key} className={`flex-1 flex-row ${i === 0 ? "ml-2" : ""}`}>
            {/* Dividers between the stats only, not after the donut. */}
            {i > 0 && <View className="mx-2 w-px self-stretch bg-web-divider" />}
            {/* Centered in its column, label over value. */}
            <View className="flex-1 items-center justify-center">
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <Text className="font-inter-regular text-sub text-web-ink-muted">{label}</Text>
              </View>
              <Text className="mt-0.5 text-center font-inter-bold text-subheading text-web-ink">{value}</Text>
            </View>
          </View>
        ))}
      </View>
      {note}
    </View>
  );
}

// A day that misses the nutrition goal (BUG-9): how far, what would close it
// when an extra cup of rice with each meal would, and that more meals are on
// the way. Quiet: a small icon and muted text, only on days that miss.
function GoalGapNote({ plan, day, totals }: { plan: MealPlan; day: PlanDay; totals: { calories: number; protein: number } }) {
  const gap = dayGoalGap(totals, plan.targets);
  if (!gap) return null;
  const cups = plan.rice?.cups ?? 0;
  const riceMeals = day.meals.filter(({ meal }) => !meal.ownCarb).length;
  const cupKcal = (plan.rice?.cup ?? FALLBACK_RICE_CUP).calories;
  const riceCloses = gap.kcal < 0 && cups < 2 && riceMeals * cupKcal >= -gap.kcal;
  const first =
    gap.kcal < 0
      ? `About ${(-gap.kcal).toLocaleString("en-PH")} kcal short of your goal today.`
      : gap.kcal > 0
        ? `About ${gap.kcal.toLocaleString("en-PH")} kcal over your goal today.`
        : `About ${gap.proteinShort} g protein short of your goal today.`;
  const fix = riceCloses ? (cups === 0 ? " A cup of rice with each meal would close it." : " An extra cup of rice with each meal would close it.") : "";
  return (
    <View className="flex-row items-start gap-2 px-1">
      <View className="pt-0.5">
        <Info color={colors.accent} size={14} />
      </View>
      <Text className="flex-1 font-inter-regular text-small text-web-ink-muted">
        <Text className="font-inter-semibold text-web-ink">{first}</Text>
        {fix} More filling meals are on the way.
      </Text>
    </View>
  );
}

// Meal colors for the cost split (the same three across the plan).
const MEAL_COLORS: Record<MealSlot, string> = {
  breakfast: colors.brandOrange,
  lunch: colors.brandGreen.DEFAULT,
  dinner: colors.webInk.soft,
};

// The selected day at a glance. With a macro goal: the macro split (donut
// by calories), the day against the calorie goal and each macro against its
// target. Without: the same card for money, today's cost split by meal and
// the day against its share of the budget (budget / the plan's days, what
// the planner plans each day within).
export function SummaryRow({ plan, day }: { plan: MealPlan; day: PlanDay }) {
  const totals = dayTotals(day, plan.servings, plan.rice);
  if (plan.targets) {
    const calories = Math.round(totals.calories);
    const share = Math.round((calories / plan.targets.calories) * 100);
    return (
      <SummaryCard
        // Macros are one person's portion; the rows' "Serves N" covers prices.
        title={plan.servings > 1 ? "Nutrition per serving" : "Today's nutrition"}
        goal={
          <>
            <Text className="font-inter-bold text-web-ink">{share}%</Text> of {plan.targets.calories.toLocaleString("en-PH")} kcal goal
          </>
        }
        donut={
          <SplitDonut
            centerValue={calories.toLocaleString("en-PH")}
            centerLabel="kcal"
            parts={MACROS.map(({ key, color }) => ({ key, color, value: totals[key] * (key === "fats" ? 9 : 4) }))}
          />
        }
        // Each macro against its target: "112/120g".
        stats={MACROS.map(({ key, label, color }) => ({ key, label, color, value: `${Math.round(totals[key])}/${plan.targets![key]}g` }))}
        note={<GoalGapNote plan={plan} day={day} totals={totals} />}
      />
    );
  }

  const dayBudget = plan.budget / plan.days.length;
  const cost = Math.round(totals.cost);
  const share = Math.round((cost / dayBudget) * 100);
  const mealCost = (slot: MealSlot) => {
    const item = day.meals.find((m) => m.slot === slot);
    // With its rice, so the split adds up to the day's cost.
    return item ? costOfMeal(slot, item.meal, plan.servings, plan.rice) : 0;
  };
  return (
    <SummaryCard
      title={plan.servings > 1 ? `Today's cost for ${plan.servings}` : "Today's cost"}
      goal={
        <>
          <Text className="font-inter-bold text-web-ink">{share}%</Text> of {formatPeso(dayBudget)} daily budget
        </>
      }
      donut={
        <SplitDonut
          centerValue={formatPeso(cost)}
          centerLabel="today"
          parts={SLOTS.map((slot) => ({ key: slot, color: MEAL_COLORS[slot], value: mealCost(slot) }))}
        />
      }
      stats={SLOTS.map((slot) => ({ key: slot, label: SLOT_LABELS[slot], color: MEAL_COLORS[slot], value: formatPeso(mealCost(slot)) }))}
    />
  );
}

const SLOT_ICONS: Record<MealSlot, LucideIcon> = { breakfast: CloudSun, lunch: Sun, dinner: Moon };

// ---- Hero carousel ---------------------------------------------------------------

// Dark fade up from the bottom so the white text reads on any photo.
const HERO_SCRIM = ["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.82)"] as const;
const HERO_HEIGHT = 240;
// Each card is this share of the column, so the next one peeks in from the
// right edge (it reads as swipeable).
const CARD_SHARE = 0.88;
const CARD_GAP = 10;
// The screen's side padding: the carousel bleeds into it so the peek
// reaches the screen edge.
const BLEED = 20;

type HeroCarouselProps = {
  day: PlanDay;
  /** Above 1: the cost reads "for N", the macros "per serving". */
  servings: number;
  /** The plan's rice: a "+ 1 cup rice" line on each meal that goes with
   *  rice, and in the meal's cost. */
  rice?: PlanRice | null;
  width: number;
  /** Which meal (0-2) is showing. */
  selected: number;
  onChange: (index: number) => void;
  onOpen: (item: PlannedMeal) => void;
  /** Swap the meal on this card (Pro). */
  onSwap: (item: PlannedMeal) => void;
  /** Free: the Swap button shows a lock (onSwap opens Pro). */
  swapLocked: boolean;
};

// The day's meals: Breakfast / Lunch / Dinner tabs over big swipeable photo
// cards, kept in sync both ways (tap a tab, or swipe). Each card: its slot,
// a Swap button for that meal, the name, kcal and protein, and the cost.
// After the day's meals: Snacks, not planned yet, as a "coming soon" card.
type SnacksSoon = { slot: "snacks"; soon: true };
type CarouselItem = PlannedMeal | SnacksSoon;
const SNACKS_SOON: SnacksSoon = { slot: "snacks", soon: true };
const isSoon = (item: CarouselItem): item is SnacksSoon => "soon" in item;

export function HeroCarousel({ day, servings, rice, width, selected, onChange, onOpen, onSwap, swapLocked }: HeroCarouselProps) {
  const list = useRef<FlatList<CarouselItem>>(null);
  const items: CarouselItem[] = [...day.meals, SNACKS_SOON];
  const cardWidth = Math.round(width * CARD_SHARE);
  const step = cardWidth + CARD_GAP;

  useEffect(() => {
    list.current?.scrollToOffset({ offset: selected * step, animated: true });
  }, [selected, step]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (index !== selected) onChange(index);
  };

  return (
    <View className="gap-3">
      <SegmentedSwitch
        fill
        size="md"
        options={[...day.meals.map((m) => ({ value: m.slot as string, label: SLOT_LABELS[m.slot] })), { value: "snacks", label: "Snacks" }]}
        value={items[selected]?.slot ?? day.meals[0].slot}
        onChange={(slot) => onChange(Math.max(0, items.findIndex((m) => m.slot === slot)))}
      />
      <FlatList
        ref={list}
        horizontal
        data={items}
        keyExtractor={(item) => item.slot}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        style={{ marginHorizontal: -BLEED }}
        contentContainerStyle={{ paddingHorizontal: BLEED, gap: CARD_GAP }}
        getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
        renderItem={({ item }) => {
          if (isSoon(item)) {
            return (
              <View
                style={{ width: cardWidth, height: HERO_HEIGHT }}
                className="items-center justify-center rounded-3xl border border-dashed border-primary/20 bg-primary/5 px-8"
              >
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Cookie color={colors.primary} size={26} />
                </View>
                <View className="mt-4 rounded-full bg-accent/15 px-2.5 py-0.5">
                  <Text className="font-inter-bold text-sub uppercase tracking-widest text-accent">Coming soon</Text>
                </View>
                <Text className="mt-3 text-center font-inter-extrabold text-heading tracking-tight text-ink-emphasis">Snacks</Text>
                <Text className="mt-1.5 text-center font-inter-regular text-body text-ink-subtle">
                  Merienda picks to round out your day, counted in your plan and budget.
                </Text>
              </View>
            );
          }
          const Icon = SLOT_ICONS[item.slot];
          const cups = riceCupsFor(item.slot, item.meal, rice);
          return (
            <Pressable
              onPress={() => onOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_LABELS[item.slot]}: ${item.meal.name}. Open recipe`}
              style={{ width: cardWidth, height: HERO_HEIGHT }}
              className="overflow-hidden rounded-3xl active:opacity-95"
            >
              <MealImage meal={item.meal} height={HERO_HEIGHT} width={cardWidth} rounded="rounded-3xl" />
              <LinearGradient colors={HERO_SCRIM} pointerEvents="none" style={{ position: "absolute", inset: 0 }} />
              <View pointerEvents="box-none" className="absolute inset-0 justify-between p-4">
                <View pointerEvents="box-none" className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1">
                    <Icon color={colors.white} size={14} />
                    <Text className="font-inter-semibold text-small text-white">{SLOT_LABELS[item.slot]}</Text>
                  </View>
                  <Pressable
                    onPress={() => onSwap(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={swapLocked ? `Swap ${SLOT_LABELS[item.slot]}, a Pro feature` : `Swap ${SLOT_LABELS[item.slot]}`}
                    className="flex-row items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 active:bg-white"
                  >
                    {swapLocked ? (
                      <Lock color={colors.accent} size={12} strokeWidth={2.5} />
                    ) : (
                      <ArrowLeftRight color={colors.ink.emphasis} size={13} />
                    )}
                    <Text className="font-inter-semibold text-small text-ink-emphasis">Swap</Text>
                  </Pressable>
                </View>

                <View className="flex-row items-end gap-3">
                  <View className="flex-1">
                    {/* The plan's rice with this meal: a frosted pill over the
                        photo, above the name, so it reads as part of the meal. */}
                    {cups > 0 && rice && (
                      <View className="mb-2 flex-row items-center gap-1.5 self-start rounded-full border border-white/30 bg-white/20 px-2.5 py-1">
                        <CookingPot color={colors.white} size={13} />
                        <Text className="font-inter-semibold text-small text-white">
                          + {cups} {cups === 1 ? "cup" : "cups"} rice
                          <Text className="font-inter-regular text-white/75">{`  ·  ${Math.round(cups * rice.cup.calories)} kcal`}</Text>
                        </Text>
                      </View>
                    )}
                    <Text numberOfLines={2} className="font-inter-extrabold text-heading tracking-tight text-white">
                      {item.meal.name}
                    </Text>
                    <View className="mt-1.5 flex-row items-center gap-2">
                      <Flame color={colors.brandOrange} size={13} />
                      <Text className="font-inter-regular text-small text-white/85">
                        <Text className="font-inter-bold text-white">{Math.round(item.meal.calories)}</Text> kcal
                        {"  ·  "}
                        <Text className="font-inter-bold text-white">{Math.round(item.meal.protein)}g</Text> protein
                        {servings > 1 ? "  ·  per serving" : ""}
                      </Text>
                    </View>

                  </View>
                  <View className="items-end">
                    <Text className="font-inter-extrabold text-subheading text-white">{formatPeso(costOfMeal(item.slot, item.meal, servings, rice))}</Text>
                    <Text className="font-inter-semibold text-sub uppercase tracking-wide text-white/75">
                      {servings > 1 ? `for ${servings}` : "per person"}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// ---- Day actions -------------------------------------------------------------------

// Under the meals: new meals for the day being viewed (Pro; Free shows a
// lock and opens the Pro page).
export function RegenerateDayButton({ dayName, locked, onPress }: { dayName: string; locked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `New meals for ${dayName}, a Pro feature` : `New meals for ${dayName}`}
      className="flex-row items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-white py-3.5 active:bg-primary/5"
    >
      {locked ? <Lock color={colors.accent} size={14} strokeWidth={2.5} /> : <RefreshCw color={colors.primary} size={16} />}
      <Text className="font-inter-semibold text-body text-primary">New meals for {dayName}</Text>
      {locked && <ProBadge />}
    </Pressable>
  );
}

// Width helper for the hero: measured once from the content column.
export function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width) };
}

// ---- Grocery -----------------------------------------------------------------------

type GroceryCardProps = {
  /** The day being viewed: "today", or e.g. "Wed, Nov 12". */
  dayName: string;
  /** The day's list, for the "11 items · about ₱276" line. */
  dayItems: number;
  dayTotal: number;
  /** The whole plan's list (Pro only; 0 while it's not fetched). */
  weekItems: number;
  /** Free: the week's row shows a lock and opens the Pro page. */
  weekLocked: boolean;
  onDay: () => void;
  onWeek: () => void;
};

// Both grocery lists as one card: the day being viewed (dark green, the main
// action) over the whole plan's (both the same sheet as Profile's Grocery
// tab).
export function GroceryCard({ dayName, dayItems, dayTotal, weekItems, weekLocked, onDay, onWeek }: GroceryCardProps) {
  return (
    <View className="overflow-hidden rounded-2xl border border-primary/10">
      <Pressable onPress={onDay} accessibilityRole="button" className="flex-row items-center gap-3 bg-brand-green-dark px-4 py-3.5 active:opacity-90">
        <ShoppingCart color={colors.white} size={18} />
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-white">{dayName === "today" ? "Today's grocery list" : `Grocery list for ${dayName}`}</Text>
          {dayItems > 0 && (
            <Text className="mt-0.5 font-inter-regular text-small text-white/70">
              {dayItems} {dayItems === 1 ? "item" : "items"} · about {formatPeso(dayTotal)}
            </Text>
          )}
        </View>
        <ChevronRight color={colors.white} size={18} />
      </Pressable>
      <Pressable onPress={onWeek} accessibilityRole="button" className="flex-row items-center gap-3 bg-white px-4 py-3 active:bg-primary/5">
        {weekLocked ? <Lock color={colors.accent} size={16} strokeWidth={2.5} /> : <ShoppingCart color={colors.brandGreen.dark} size={17} />}
        <View className="flex-1 flex-row flex-wrap items-center gap-x-1.5">
          <Text className="font-inter-semibold text-body text-ink-emphasis">Shop the whole week in one trip</Text>
          {weekLocked && <ProBadge />}
        </View>
        {!weekLocked && weekItems > 0 && <Text className="font-inter-regular text-small text-ink-subtle">{weekItems} items</Text>}
        <ChevronRight color={colors.ink.subtle} size={18} />
      </Pressable>
    </View>
  );
}

export type PlanFocus = "budget" | "nutrition";

/** What the plan aims at, under "Your week" (IMP-1). With a nutrition goal
 *  (Pro): a Budget / Nutrition switch that re-plans the same days. Without
 *  one: a "Set your goals" text link (the
 *  goals sheet; Free gets the Nutrition goals feature sheet, with PRO). */
export function PlanFocusRow({
  focus,
  targets,
  locked,
  onChange,
  onSetGoals,
}: {
  /** null: no nutrition goal to switch to. */
  focus: PlanFocus | null;
  /** The goal the Nutrition side aims at (per person, a day). */
  targets: MacroTargets | null;
  locked: boolean;
  onChange: (focus: PlanFocus) => void;
  onSetGoals: () => void;
}) {
  if (!focus || !targets) {
    return (
      <Pressable
        onPress={onSetGoals}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={locked ? "Set your nutrition goals, a Pro feature" : "Set your nutrition goals"}
        className="flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <Flame color={colors.primary} size={15} />
        <Text className="font-inter-semibold text-small text-primary">Set your goals</Text>
        {locked && <ProBadge />}
        <ChevronRight color={colors.primary} size={15} />
      </Pressable>
    );
  }
  return (
    <SegmentedSwitch
      options={[
        { value: "budget", label: "Budget" },
        { value: "nutrition", label: "Nutrition" },
      ]}
      value={focus}
      onChange={onChange}
    />
  );
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/** A plan's dates for its title, split so the days can take the accent:
 *  { month: "Nov", days: "22 – 26" }, or across a month
 *  { month: "Nov", days: "30 – Dec 4" }. */
export function dateRange(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return { month: MONTH.format(from), days: sameMonth ? `${from.getDate()} – ${to.getDate()}` : `${from.getDate()} – ${monthDay(to)}` };
}
