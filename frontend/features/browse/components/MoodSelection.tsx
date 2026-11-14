import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import * as Haptics from "expo-haptics";
import Animated, { Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeOut } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { AppText, SegmentedSwitch } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealPhotoTile, type MealPhotoTileSize } from "@/frontend/core/meals/components/card/MealPhotoTile";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { FREE_RESULTS_CAP } from "@/frontend/core/pro/proContent";
import { BLUR, SeeAllMatchesCard } from "@/frontend/core/pro/components/SeeAllMatchesCard";

type MoodId = "tipid" | "highProtein" | "quickEasy";

const priceOf = (m: MealType) => Number(m.price);
// Per-serving prices come out of scaleMeal with decimals ("140.00"): whole pesos read cleaner.
const pesoLabel = (m: MealType) => `₱${Math.round(priceOf(m))}`;
const proteinLabel = (m: MealType) => `${Math.round(m.protein)}g protein`;
const timeLabel = (m: MealType) => (m.total_time != null ? `${m.total_time} min` : null);

type Mood = {
  id: MoodId;
  label: string;
  /** The promise (documents the rule; not shown). */
  caption: string;
  /** The rule, on a real meal per serving (the caption's terms). */
  fits: (perServing: MealType) => boolean;
  /** Best fit first: cheapest, most protein, quickest. */
  sort: (a: MealType, b: MealType) => number;
  /** The tile's big number: what proves the meal fits. */
  stat: (m: MealType) => string;
  /** The line under the name: the meal's other two facts (just the first
   *  on the narrow side-by-side tiles). */
  facts: (m: MealType, short?: boolean) => string;
};

const join = (short: boolean | undefined, ...parts: (string | null)[]) =>
  parts
    .filter(Boolean)
    .slice(0, short ? 1 : undefined)
    .join(" · ");

const MOODS: Mood[] = [
  {
    id: "tipid",
    label: "Tipid",
    caption: "Under ₱150 a serving",
    fits: (m) => priceOf(m) > 0 && priceOf(m) < 150,
    sort: (a, b) => priceOf(a) - priceOf(b),
    stat: pesoLabel,
    facts: (m, short) => join(short, proteinLabel(m), timeLabel(m)),
  },
  {
    id: "highProtein",
    label: "High Protein",
    caption: "30g+ protein a serving",
    fits: (m) => m.protein >= 30,
    sort: (a, b) => b.protein - a.protein,
    stat: (m) => `${Math.round(m.protein)}g`,
    facts: (m, short) => join(short, pesoLabel(m), timeLabel(m)),
  },
  {
    id: "quickEasy",
    label: "Quick & Easy",
    caption: "Ready in 20 minutes or less",
    fits: (m) => m.total_time != null && m.total_time <= 20,
    sort: (a, b) => (a.total_time ?? 0) - (b.total_time ?? 0),
    stat: (m) => `${m.total_time} min`,
    facts: (m, short) => join(short, pesoLabel(m), proteinLabel(m)),
  },
];

const MOOD_OPTIONS = MOODS.map((m) => ({ value: m.id, label: m.label }));

// One page is one spread of 4. Back and More swap pages in place, so the
// section never grows, and each page takes the next of three shapes so
// paging stays interesting. Every shape is the same height, so the pager
// under it never moves.
const PAGE_SIZE = 4;

// A free account's mood results past FREE_RESULTS_CAP: the meal's photo,
// blurred, with a lock; opens the Pro page. Nothing about the meal legible.
type Slot = { meal: MealType; locked: boolean };
const openPro = () =>
  router.push({
    pathname: "/pro",
    params: {
      title: "See every",
      highlight: "match",
      subtitle: "Free shows the first results of each search. Pro shows them all.",
      source: "results_wall",
    },
  });

function LockedTile({ meal, height }: { meal: MealType; height: number }) {
  return (
    <Pressable
      onPress={openPro}
      accessibilityRole="button"
      accessibilityLabel="Locked meal. See every match with Pro"
      style={{ height }}
      className="flex-1 overflow-hidden rounded-2xl bg-ink-emphasis/5 active:opacity-80"
    >
      <Image
        source={resolveMealImage(meal)}
        blurRadius={BLUR}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <View className="absolute bottom-2.5 right-2.5 h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-accent">
        <Lock color={colors.white} size={12} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}
const GAP = 6;
type Shape = "spread" | "tallLeft" | "tallRight";
const SHAPES: Shape[] = ["spread", "tallLeft", "tallRight"];
// spread: wide lead, a pair, a wide closer (190 + 210 + 150 + 2 gaps).
const SPREAD = { lead: 190, pair: 210, closer: 150 };
// tallLeft / tallRight: a tall card beside two stacked small ones, and a
// wide card below (or above).
const SIDE = { row: 380, wide: 176 };
const SMALL = (SIDE.row - GAP) / 2;
const EASE = Easing.out(Easing.cubic);

type MoodSelectionProps = {
  onSelectMeal?: (meal: MealType) => void;
};

// Browse-only "ulam mood" picker: real meals (following preferences) that
// fit the mood, per serving so each tile's numbers match the mood's promise.
// Same photo tiles as Home's Community Favorites, a page of 4 at a time in
// rotating shapes, with the mood's number where Favorites puts the rank. Not
// shared with any other feature, so it lives here instead of core/meals.
export function MoodSelection({ onSelectMeal }: MoodSelectionProps) {
  const [moodId, setMoodId] = useState<MoodId>(MOODS[0].id);
  const [page, setPage] = useState(0);
  // Which way the last page turn went: the new page slides in from that side.
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduce = useReduceMotion();
  const mood = MOODS.find((m) => m.id === moodId)!;

  const pick = (id: MoodId) => {
    if (id === moodId) return;
    void Haptics.selectionAsync();
    setMoodId(id);
  };

  // Back to the first page whenever the mood changes.
  useEffect(() => {
    setPage(0);
    setDirection(1);
  }, [moodId]);

  const { meals: catalog, isLoading } = usePreferredMeals();
  const meals = useMemo(
    () =>
      catalog
        .map((meal) => scaleMeal(meal, 1))
        .filter(mood.fits)
        .sort(mood.sort),
    [catalog, mood],
  );
  // Free accounts: the first FREE_RESULTS_CAP meals, then the next ones
  // blurred, filling the rest of that page and one more page (and no
  // further). Pro: every meal.
  const isPro = useIsPro();
  const slots = useMemo<Slot[]>(() => {
    if (isPro || meals.length <= FREE_RESULTS_CAP) return meals.map((meal) => ({ meal, locked: false }));
    const clear = meals.slice(0, FREE_RESULTS_CAP);
    const lockedCount = Math.ceil(FREE_RESULTS_CAP / PAGE_SIZE) * PAGE_SIZE + PAGE_SIZE - FREE_RESULTS_CAP;
    return [
      ...clear.map((meal) => ({ meal, locked: false })),
      ...meals.slice(FREE_RESULTS_CAP, FREE_RESULTS_CAP + lockedCount).map((meal) => ({ meal, locked: true })),
    ];
  }, [meals, isPro]);
  const hiddenCount = isPro ? 0 : Math.max(0, meals.length - FREE_RESULTS_CAP);
  const pageCount = Math.max(1, Math.ceil(slots.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageSlots = slots.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const onPage = pageSlots.map((s) => s.meal);
  const pageLocked = pageSlots.some((s) => s.locked);
  const allLocked = pageSlots.length > 0 && pageSlots.every((s) => s.locked);
  const shape = SHAPES[current % SHAPES.length];

  // By one page (Back / More), or any number back (Start over).
  const turn = (by: number) => {
    const next = current + by;
    if (by === 0 || next < 0 || next >= pageCount) return;
    void Haptics.selectionAsync();
    setDirection(by > 0 ? 1 : -1);
    setPage(next);
  };

  // A page's tiles rise in turn the first time, then slide in from the side
  // a page turn came from. Plain fades with Reduce motion.
  const enter = (i: number) => {
    if (reduce) return FadeIn.duration(180);
    const base = current === 0 && direction === 1 ? FadeInDown : direction === 1 ? FadeInRight : FadeInLeft;
    return base
      .delay(i * 50)
      .duration(300)
      .easing(EASE);
  };

  const tile = (meal: MealType | undefined, i: number, size: MealPhotoTileSize, height: number, narrow = false) =>
    meal && pageSlots[i]?.locked ? (
      <Animated.View
        key={`${moodId}-${current}-locked-${meal.id}`}
        entering={enter(i)}
        exiting={FadeOut.duration(100)}
        style={{ flex: 1 }}
      >
        <LockedTile meal={meal} height={height} />
      </Animated.View>
    ) : meal ? (
      <Animated.View
        key={`${moodId}-${current}-${meal.id}`}
        entering={enter(i)}
        exiting={FadeOut.duration(100)}
        style={{ flex: 1 }}
      >
        <MealPhotoTile
          meal={meal}
          size={size}
          height={height}
          stat={mood.stat(meal)}
          caption={mood.facts(meal, narrow)}
          onPress={() => onSelectMeal?.(meal)}
          accessibilityLabel={`${meal.name}, ${mood.stat(meal)}, ${mood.facts(meal)}`}
        />
      </Animated.View>
    ) : (
      // A short last page keeps its shape (and height), with the gap empty.
      <View key={`empty-${i}`} style={{ flex: 1, height }} />
    );

  const [a, b, c, d] = onPage;
  // A short last page: what's left, then an end card in the space after it
  // (same total height, so the pager stays put).
  const nextMood = MOODS[(MOODS.findIndex((m) => m.id === moodId) + 1) % MOODS.length];
  const endCard = (height: number) =>
    pageLocked ? (
      // A short last page of locked meals: the Pro card in the space after.
      <Animated.View key={`${moodId}-end-locked`} entering={enter(onPage.length)} style={{ flex: 1, height }}>
        <SeeAllMatchesCard screen="mood" hiddenCount={hiddenCount} preview={onPage} />
      </Animated.View>
    ) : (
      <Animated.View key={`${moodId}-end`} entering={enter(onPage.length)} style={{ flex: 1, height }}>
        <View className="flex-1 items-center justify-center gap-3 rounded-2xl bg-mood-bg px-6">
          <Text className="text-center font-inter-extrabold text-subheading tracking-display text-ink-emphasis">
            That&apos;s every {mood.label} meal<Text className="text-accent">.</Text>
          </Text>
          <View className="flex-row gap-2">
            <PagerButton label="Start over" icon="back" disabled={false} onPress={() => turn(-current)} />
            <PagerButton
              label={nextMood.label}
              icon="more"
              primary
              disabled={false}
              onPress={() => pick(nextMood.id)}
            />
          </View>
        </View>
      </Animated.View>
    );
  const SPREAD_TOTAL = SPREAD.lead + SPREAD.pair + SPREAD.closer + GAP * 2;
  const short =
    onPage.length === 1 ? (
      <>
        <View className="flex-row">{tile(a, 0, "large", SPREAD.lead)}</View>
        <View className="flex-row">{endCard(SPREAD_TOTAL - SPREAD.lead - GAP)}</View>
      </>
    ) : onPage.length === 2 ? (
      <>
        <View className="flex-row" style={{ gap: GAP }}>
          {tile(a, 0, "medium", SIDE.row, true)}
          {tile(b, 1, "medium", SIDE.row, true)}
        </View>
        <View className="flex-row">{endCard(SIDE.wide)}</View>
      </>
    ) : onPage.length === 3 ? (
      <>
        <View className="flex-row">{tile(a, 0, "large", SPREAD.lead)}</View>
        <View className="flex-row" style={{ gap: GAP }}>
          {tile(b, 1, "medium", SPREAD.pair, true)}
          {tile(c, 2, "medium", SPREAD.pair, true)}
        </View>
        <View className="flex-row">{endCard(SPREAD.closer)}</View>
      </>
    ) : null;
  const stack = (first: MealType | undefined, second: MealType | undefined, at: number) => (
    <View style={{ flex: 1, gap: GAP }}>
      {tile(first, at, "small", SMALL)}
      {tile(second, at + 1, "small", SMALL)}
    </View>
  );
  const spread = short ? (
    short
  ) : shape === "spread" ? (
    <>
      <View className="flex-row">{tile(a, 0, "large", SPREAD.lead)}</View>
      <View className="flex-row" style={{ gap: GAP }}>
        {tile(b, 1, "medium", SPREAD.pair, true)}
        {tile(c, 2, "medium", SPREAD.pair, true)}
      </View>
      <View className="flex-row">{tile(d, 3, "medium", SPREAD.closer)}</View>
    </>
  ) : shape === "tallLeft" ? (
    <>
      <View className="flex-row" style={{ gap: GAP }}>
        {tile(a, 0, "medium", SIDE.row, true)}
        {stack(b, c, 1)}
      </View>
      <View className="flex-row">{tile(d, 3, "medium", SIDE.wide)}</View>
    </>
  ) : (
    <>
      <View className="flex-row">{tile(a, 0, "large", SIDE.wide)}</View>
      <View className="flex-row" style={{ gap: GAP }}>
        {stack(b, c, 1)}
        {tile(d, 3, "medium", SIDE.row, true)}
      </View>
    </>
  );

  return (
    <View className="gap-3">
      <AppText variant="sectionTitle" dot>
        What&apos;s your ulam mood?
      </AppText>

      <SegmentedSwitch size="md" options={MOOD_OPTIONS} value={moodId} onChange={pick} />

      {isLoading ? (
        <View style={{ gap: GAP }}>
          <View style={{ height: SPREAD.lead }} className="rounded-2xl bg-ink-emphasis/5" />
          <View className="flex-row" style={{ gap: GAP }}>
            <View style={{ height: SPREAD.pair }} className="flex-1 rounded-2xl bg-ink-emphasis/5" />
            <View style={{ height: SPREAD.pair }} className="flex-1 rounded-2xl bg-ink-emphasis/5" />
          </View>
          <View style={{ height: SPREAD.closer }} className="rounded-2xl bg-ink-emphasis/5" />
        </View>
      ) : meals.length === 0 ? (
        <AppText variant="caption">No meals for this mood yet. We&apos;re still curating more.</AppText>
      ) : (
        <View key={`${moodId}-${current}`} style={{ gap: GAP }}>
          {spread}
          {/* The page of locked meals: the Pro card over the blurred tiles. */}
          {allLocked && onPage.length === PAGE_SIZE && (
            <View
              pointerEvents="box-none"
              className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
            >
              <View style={{ width: 240, height: 170 }}>
                <SeeAllMatchesCard screen="mood" hiddenCount={hiddenCount} preview={onPage} />
              </View>
            </View>
          )}
        </View>
      )}

      {pageCount > 1 && (
        <View className="mt-1 flex-row items-center justify-between">
          <PagerButton label="Back" icon="back" disabled={current === 0} onPress={() => turn(-1)} />
          <Text className="font-inter-semibold text-small text-ink-subtle" accessibilityLiveRegion="polite">
            {current + 1} of {pageCount}
          </Text>
          <PagerButton label="More" icon="more" primary disabled={current === pageCount - 1} onPress={() => turn(1)} />
        </View>
      )}
    </View>
  );
}

// Back (outlined) and More (solid green), dimmed at either end.
function PagerButton({
  label,
  icon,
  primary = false,
  disabled,
  onPress,
}: {
  label: string;
  icon: "back" | "more";
  primary?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const color = primary ? colors.white : colors.ink.emphasis;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === "Back" ? "Previous meals" : label === "More" ? "More meals" : label}
      accessibilityState={{ disabled }}
      className={`flex-row items-center gap-1 rounded-full px-4 py-2.5 ${
        primary ? "bg-primary active:opacity-80" : "border border-ink-emphasis/10 bg-white active:bg-ink-emphasis/5"
      } ${disabled ? "opacity-30" : ""}`}
    >
      {icon === "back" && <ChevronLeft color={color} size={16} strokeWidth={2.5} />}
      <Text className={`font-inter-semibold text-small ${primary ? "text-white" : "text-ink-emphasis"}`}>{label}</Text>
      {icon === "more" && <ChevronRight color={color} size={16} strokeWidth={2.5} />}
    </Pressable>
  );
}
