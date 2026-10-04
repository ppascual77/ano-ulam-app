import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
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

// Small ring: how much of the calorie target the day reaches.
function CalorieRing({ share }: { share: number }) {
  const size = 44;
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

function SummaryChip({ Icon, color, tint, value, label }: { Icon?: LucideIcon; color?: string; tint?: string; value: string; label: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-web-divider bg-white px-2 py-1.5">
      {Icon && color && (
        <View className={`h-7 w-7 items-center justify-center rounded-full ${tint}`}>
          <Icon color={color} size={13} />
        </View>
      )}
      <View className="shrink">
        <Text className="font-inter-bold text-small text-web-ink" numberOfLines={1}>
          {value}
        </Text>
        <Text className="font-inter-regular text-sub text-web-ink-muted" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// The selected day at a glance. With a macro goal: a calorie ring (vs the
// target) and macro chips. Without: cost and calories, no macro tracking.
export function SummaryRow({ plan, day }: { plan: MealPlan; day: PlanDay }) {
  const totals = dayTotals(day, plan.servings);
  if (plan.targets) {
    return (
      <View className="flex-row items-center gap-2">
        <View className="flex-row items-center gap-2 pr-1">
          <CalorieRing share={totals.calories / plan.targets.calories} />
          <View>
            <Text className="font-inter-bold text-body text-web-ink">{totals.calories.toLocaleString("en-PH")}</Text>
            <Text className="font-inter-regular text-sub text-web-ink-muted">kcal</Text>
          </View>
        </View>
        {MACROS.map(({ key, label, Icon, color, tint }) => (
          <SummaryChip key={key} Icon={Icon} color={color} tint={tint} value={`${totals[key]}g`} label={label} />
        ))}
      </View>
    );
  }
  const weekCost = plan.days.reduce((sum, d) => sum + dayTotals(d, plan.servings).cost, 0);
  return (
    <View className="flex-row gap-2">
      <SummaryChip value={`~${formatPeso(totals.cost)}`} label="today" />
      <SummaryChip value={`~${formatPeso(weekCost)}`} label={`this week of ${formatPeso(plan.budget)}`} />
      <SummaryChip value={totals.calories.toLocaleString("en-PH")} label="kcal today" />
    </View>
  );
}

// ---- Hero carousel ---------------------------------------------------------------

// Dark fade from the left/bottom so the white text reads on any photo.
const HERO_SCRIM = ["rgba(0,0,0,0.75)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"] as const;
const HERO_HEIGHT = 200;

// A stat on the photo: colored dot (or the flame for kcal), bold value,
// light label, on a frosted pill so it reads on any photo.
function GlassStat({ value, label, color, flame }: { value: string; label: string; color?: string; flame?: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-3 py-1.5">
      {flame ? (
        <Flame color={colors.brandOrange} size={13} />
      ) : (
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <Text className="font-inter-bold text-small text-white">{value}</Text>
      <Text className="font-inter-regular text-small text-white/75">{label}</Text>
    </View>
  );
}

type HeroCarouselProps = {
  day: PlanDay;
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
export function HeroCarousel({ day, dayIndex, width, selected, onChange, onOpen }: HeroCarouselProps) {
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
              <View className="gap-1.5 pr-12">
                <Text numberOfLines={2} className="font-inter-bold text-heading leading-7 text-white">
                  {item.meal.name}
                </Text>
                {!!item.meal.description && (
                  <Text numberOfLines={1} className="font-inter-regular text-small text-white/80">
                    {item.meal.description}
                  </Text>
                )}
                <View className="mt-1 flex-row flex-wrap gap-1.5">
                  <GlassStat flame value={String(item.meal.calories)} label="kcal" />
                  {MACROS.map(({ key, letter, color }) => (
                    <GlassStat key={key} color={color} value={`${item.meal[key]}g`} label={letter} />
                  ))}
                </View>
              </View>
            </View>
            <View pointerEvents="none" className="absolute bottom-4 right-4 h-9 w-9 items-center justify-center rounded-full bg-white">
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
  showMacros: boolean;
  servings: number;
  onPress: () => void;
};

// A light index under the hero (which carries the detail): thumbnail, name,
// one quiet line (kcal, plus cost without a macro goal), ›. Tap to bring the
// meal into the hero.
export function MealListRow({ item, active, showMacros, servings, onPress }: MealListRowProps) {
  const { meal } = item;
  const perPerson = Number(meal.price) / (meal.serving_size ?? 1);
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      className={`flex-row items-center gap-3 rounded-2xl border p-2 ${active ? "border-brand-green/20 bg-brand-green/10" : "border-web-divider bg-white"}`}
    >
      <MealImage meal={meal} height={56} width={56} rounded="rounded-xl" />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-inter-semibold text-subheading text-web-ink">
          {meal.name}
        </Text>
        <Text className="font-inter-regular text-small text-web-ink-muted">
          {showMacros ? `${meal.calories} kcal` : `~${formatPeso(perPerson * servings)}${servings > 1 ? ` for ${servings}` : ""} · ${meal.calories} kcal`}
        </Text>
      </View>
      <ChevronRight color={colors.webInk.muted} size={18} />
    </Pressable>
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
