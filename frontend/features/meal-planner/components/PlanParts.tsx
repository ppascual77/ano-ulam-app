import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeftRight, ChevronRight, Droplets, Dumbbell, Flame, Lock, Pencil, RefreshCw, Wheat, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { MacroTargets } from "../utils/macros";
import { SLOT_LABELS, dayLabel, dayTotals, formatPeso, monthDay, type MealPlan, type PlanDay, type PlannedMeal } from "../utils/generatePlan";
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

// Five equal day pills. Free users see days 2-5 locked.
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

// ---- Summary row -------------------------------------------------------------

const MACROS: { key: "protein" | "carbs" | "fats"; letter: string; label: string; Icon: LucideIcon; color: string; tint: string }[] = [
  { key: "protein", letter: "P", label: "Protein", Icon: Dumbbell, color: colors.macro.protein, tint: "bg-macro-protein/10" },
  { key: "carbs", letter: "C", label: "Carbs", Icon: Wheat, color: colors.macro.carbs, tint: "bg-macro-carbs/10" },
  { key: "fats", letter: "F", label: "Fats", Icon: Droplets, color: colors.macro.fats, tint: "bg-macro-fats/10" },
];

function SummaryChip({ Icon, color, tint, value, label }: { Icon?: LucideIcon; color?: string; tint?: string; value: string; label: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-web-divider bg-white px-2 py-1.5">
      {Icon && color && (
        <View className={`h-7 w-7 items-center justify-center rounded-full ${tint}`}>
          <Icon color={color} size={13} />
        </View>
      )}
      {/* Label above the value, like the stats fields. */}
      <View className="shrink">
        <Text className="font-inter-regular text-sub text-web-ink-muted" numberOfLines={1}>
          {label}
        </Text>
        <Text className="font-inter-bold text-small text-web-ink" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// Small donut of the macro split: protein / carbs / fat as their share of
// the calories (4 / 4 / 9 kcal per gram), kcal in the middle.
function MacroDonut({ calories, protein, carbs, fats }: { calories: number; protein: number; carbs: number; fats: number }) {
  const size = 58;
  const stroke = 6;
  const gap = 3; // px of track between slices
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const parts = [
    { key: "protein", kcal: protein * 4, color: colors.macro.protein },
    { key: "carbs", kcal: carbs * 4, color: colors.macro.carbs },
    { key: "fats", kcal: fats * 9, color: colors.macro.fats },
  ].filter((p) => p.kcal > 0);
  const total = parts.reduce((sum, p) => sum + p.kcal, 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.webDivider} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          parts.map((p) => {
            const length = Math.max(0, (p.kcal / total) * circumference - gap);
            const dashOffset = -offset;
            offset += (p.kcal / total) * circumference;
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
      <Text className="font-inter-bold text-small text-web-ink">{calories.toLocaleString("en-PH")}</Text>
      <Text className="-mt-0.5 font-inter-regular text-sub text-web-ink-muted">kcal</Text>
    </View>
  );
}

// The selected day at a glance, one compact row. With a macro goal: the
// macro donut, then protein / carbs / fat as plain stats (dot + label over a
// bold value), and how the day compares to the calorie goal. Without: cost
// and calories, no macro tracking.
export function SummaryRow({ plan, day }: { plan: MealPlan; day: PlanDay }) {
  const totals = dayTotals(day, plan.servings);
  if (plan.targets) {
    const calories = Math.round(totals.calories);
    const share = Math.round((calories / plan.targets.calories) * 100);
    return (
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          {/* Macros are one person's portion; prices cover everyone. */}
          <Text className="font-inter-regular text-sub text-web-ink-muted">
            {plan.servings > 1 ? `Nutrition per serving · prices for ${plan.servings}` : "Your plate today"}
          </Text>
          <Text className="font-inter-regular text-sub text-web-ink-muted">
            <Text className="font-inter-bold text-web-ink">{share}%</Text> of {plan.targets.calories.toLocaleString("en-PH")} kcal goal
          </Text>
        </View>
        <View className="flex-row items-center rounded-2xl border border-web-divider bg-white px-3 py-2.5">
          <MacroDonut calories={calories} protein={totals.protein} carbs={totals.carbs} fats={totals.fats} />
          {MACROS.map(({ key, label, color }) => (
            <View key={key} className="flex-1 flex-row">
              <View className="mx-2 w-px self-stretch bg-web-divider" />
              <View className="flex-1 justify-center">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <Text className="font-inter-regular text-sub text-web-ink-muted">{label}</Text>
                </View>
                <Text className="mt-0.5 font-inter-bold text-subheading text-web-ink">{Math.round(totals[key])}g</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }
  const weekCost = plan.days.reduce((sum, d) => sum + dayTotals(d, plan.servings).cost, 0);
  return (
    <View className="flex-row gap-2">
      <SummaryChip value={`~${formatPeso(totals.cost)}`} label="Today" />
      <SummaryChip value={`~${formatPeso(weekCost)}`} label={`Week of ${formatPeso(plan.budget)}`} />
      <SummaryChip value={`${Math.round(totals.calories).toLocaleString("en-PH")} kcal`} label="Calories" />
    </View>
  );
}

// ---- Hero carousel ---------------------------------------------------------------

// Dark fade from the left/bottom so the white text reads on any photo.
const HERO_SCRIM = ["rgba(0,0,0,0.75)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"] as const;
const HERO_HEIGHT = 240;

// A stat on the photo, in the stats-field format: icon on the left, small
// label above a bold value. Frosted so it reads on any photo.
function GlassStat({ value, label, color, flame }: { value: string; label: string; color?: string; flame?: boolean }) {
  return (
    <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-white/20 bg-black/35 px-2 py-1.5">
      {flame ? (
        <Flame color={colors.brandOrange} size={14} />
      ) : (
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <View className="shrink">
        <Text numberOfLines={1} className="font-inter-regular text-sub text-white/75">
          {label}
        </Text>
        <Text numberOfLines={1} className="font-inter-bold text-small text-white">
          {value}
        </Text>
      </View>
    </View>
  );
}

type HeroCarouselProps = {
  day: PlanDay;
  /** Above 1: a "Per serving" caption over the macro tiles. */
  servings: number;
  dayIndex: number;
  width: number;
  /** Which meal (0-2) is showing. */
  selected: number;
  onChange: (index: number) => void;
  onOpen: (item: PlannedMeal) => void;
};

// The day's meals as big swipeable photo cards: date, name, description and
// macro pills over a dark fade, a › to open the recipe, and paging dots.
// Kept in sync with the list below (tapping a row scrolls here).
export function HeroCarousel({ day, servings, dayIndex, width, selected, onChange, onOpen }: HeroCarouselProps) {
  const list = useRef<FlatList<PlannedMeal>>(null);

  useEffect(() => {
    list.current?.scrollToOffset({ offset: selected * width, animated: true });
  }, [selected, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== selected) onChange(index);
  };

  return (
    <View className="gap-2.5">
      <FlatList
        ref={list}
        horizontal
        pagingEnabled
        data={day.meals}
        keyExtractor={(item) => item.slot}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} style={{ width, height: HERO_HEIGHT }} className="overflow-hidden rounded-3xl">
            <MealImage meal={item.meal} height={HERO_HEIGHT} width={width} rounded="rounded-3xl" />
            <LinearGradient
              colors={HERO_SCRIM}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              style={{ position: "absolute", inset: 0 }}
            />
            <View pointerEvents="box-none" className="absolute inset-0 justify-between p-4">
              <Text className="font-inter-medium text-small text-white/90">
                {dayLabel(day.date, dayIndex)} · {monthDay(day.date)} · {SLOT_LABELS[item.slot]}
              </Text>
              <View className="gap-1.5">
                <Text numberOfLines={2} className="pr-4 font-inter-bold text-heading leading-7 text-white">
                  {item.meal.name}
                </Text>
                {!!item.meal.description && (
                  <Text numberOfLines={1} className="font-inter-regular text-small text-white/80">
                    {item.meal.description}
                  </Text>
                )}
                {servings > 1 && <Text className="mt-1 font-inter-medium text-sub text-white/75">Per serving</Text>}
                {/* Four equal tiles across the card. */}
                <View className="mt-1.5 flex-row gap-1.5">
                  <GlassStat flame value={`${Math.round(item.meal.calories)}`} label="Calories" />
                  {MACROS.map(({ key, label, color }) => (
                    <GlassStat key={key} color={color} value={`${Math.round(item.meal[key])}g`} label={label} />
                  ))}
                </View>
              </View>
            </View>
            {/* Open-recipe arrow, top right (the stats take the bottom row). */}
            <View pointerEvents="none" className="absolute right-4 top-4 h-8 w-8 items-center justify-center rounded-full bg-white">
              <ChevronRight color={colors.webInk.DEFAULT} size={18} />
            </View>
          </Pressable>
        )}
      />
      <View className="flex-row justify-center gap-1.5">
        {day.meals.map((item, i) => (
          <View key={item.slot} className={`h-1.5 rounded-full ${i === selected ? "w-5 bg-web-ink" : "w-1.5 bg-web-ink-faint"}`} />
        ))}
      </View>
    </View>
  );
}

// ---- Meal list ---------------------------------------------------------------------

type MealListRowProps = {
  item: PlannedMeal;
  /** The meal showing in the hero: highlighted. */
  active: boolean;
  servings: number;
  onPress: () => void;
};

// Highlight colors: brand green at 10% (background) and 20% (border) over
// white, pre-blended to solid colors. Fading between white and a
// translucent green passes through a half-opaque darker green midway (a
// visible flash); solid end colors fade cleanly.
const ROW_ACTIVE_BG = "rgb(230,240,237)";
const ROW_ACTIVE_BORDER = "rgb(204,226,219)";
const HIGHLIGHT_MS = 250;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A light index under the hero (which carries the nutrition detail):
// thumbnail, name, the meal's cost for everyone eating, ›. Tap to bring the
// meal into the hero.
export function MealListRow({ item, active, servings, onPress }: MealListRowProps) {
  const { meal } = item;
  const perPerson = Number(meal.price) / (meal.serving_size ?? 1);
  // The highlight fades between rows when the hero changes (swipe or tap).
  const highlight = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    highlight.value = withTiming(active ? 1 : 0, { duration: HIGHLIGHT_MS });
  }, [active, highlight]);
  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(highlight.value, [0, 1], [colors.white, ROW_ACTIVE_BG]),
    borderColor: interpolateColor(highlight.value, [0, 1], [colors.webDivider, ROW_ACTIVE_BORDER]),
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={highlightStyle}
      className="flex-row items-center gap-3 rounded-2xl border p-2"
    >
      <MealImage meal={meal} height={56} width={56} rounded="rounded-xl" />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-inter-semibold text-subheading text-web-ink">
          {meal.name}
        </Text>
        {/* Price in the brand green · who it feeds. */}
        <Text className="mt-0.5 font-inter-bold text-body text-primary">
          ~{formatPeso(perPerson * servings)}
          <Text className="font-inter-regular text-web-ink-muted"> · Serves {servings}</Text>
        </Text>
      </View>
      <ChevronRight color={colors.webInk.muted} size={18} />
    </AnimatedPressable>
  );
}

// ---- Day actions -------------------------------------------------------------------

type DayActionsProps = {
  /** Free: actions show a lock and open the unlock sheet. */
  locked: boolean;
  onRegenerate: () => void;
  onSwap: () => void;
  onEdit: () => void;
};

function ActionButton({ Icon, label, locked, onPress }: { Icon: LucideIcon; label: string; locked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-web-divider bg-white py-3 active:bg-web-divider/50">
      {locked ? <Lock color={colors.webInk.muted} size={13} /> : <Icon color={colors.webInk.soft} size={14} />}
      <Text className={`font-inter-semibold text-small ${locked ? "text-web-ink-muted" : "text-web-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

export function DayActions({ locked, onRegenerate, onSwap, onEdit }: DayActionsProps) {
  return (
    <View className="flex-row gap-2">
      <ActionButton Icon={RefreshCw} label="Regenerate day" locked={locked} onPress={onRegenerate} />
      <ActionButton Icon={ArrowLeftRight} label="Swap meal" locked={locked} onPress={onSwap} />
      <ActionButton Icon={Pencil} label="Edit day" locked={locked} onPress={onEdit} />
    </View>
  );
}

// Width helper for the hero: measured once from the content column.
export function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width) };
}
