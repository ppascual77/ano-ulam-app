import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { ArrowLeft, Bookmark, Check, Plus } from "lucide-react-native";
import { AppText, LoadingState, Screen, SegmentedSwitch } from "@/frontend/components/ui";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePantry, usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import {
  usePantryMatches,
  type MatchTier,
  type MissingIngredient,
  type PantryMealMatch,
} from "@/frontend/core/pantry/hooks/usePantryMatches";
import { TIER_COLOR } from "@/frontend/core/pantry/components/PantryMatchCard";
import { pantryName, pantryNameLower } from "@/frontend/core/pantry/pantryName";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { formatMealPrice } from "@/frontend/core/prices/utils/prices";
import { SeeAllMatchesCard } from "@/frontend/core/pro/components/SeeAllMatchesCard";
import { FREE_RESULTS_CAP } from "@/frontend/core/pro/proContent";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";

const ROW_STAGGER_MS = 50;
const ROW_STAGGER_CAP = 8;
const MISSING_SHOWN = 3;
// Past this many ingredients the dots get too small to count: "7 of 12" alone.
const MAX_DOTS = 12;
const PHOTO = 84;
// How long a tapped "+ kangkong" shows its check before the meal moves.
const HAVE_IT_MS = 650;
const EASE = Easing.out(Easing.cubic);

const TABS: { tier: MatchTier; label: string; blurb: string }[] = [
  { tier: "cookNow", label: "Cook now", blurb: "You have everything, or just a basic or two." },
  { tier: "almost", label: "Almost", blurb: "Missing one or two things. Have one? Tap it." },
  { tier: "trip", label: "Need a trip", blurb: "Worth a palengke trip. Tap anything you already have." },
];

type Row = { match: PantryMealMatch; meal: MealType; order: number };

// "See what to cook": every catalog meal that uses something in the pantry,
// in tabs by how ready it is (Cook now / Almost / Need a trip), each row
// showing how much you have and what's missing. Tapping a missing chip adds
// it to the pantry ("I have it"), and the meal moves to the tab it now fits.
// Reads the shared pantry directly, so it's current from Home or Profile.
export default function PantryResultsScreen() {
  const { data: pantry = [] } = usePantry();
  const pantryActions = usePantryActions();
  const { results, tierCounts, isLoading: matching } = usePantryMatches(pantry);
  const { data: meals, isLoading: loadingMeals } = useRealMeals();
  const detail = useMealDetail();
  const savedMeals = useSavedMealActions();
  const reduce = useReduceMotion();

  // A free account sees the first FREE_RESULTS_CAP matches (readiest
  // first, across tabs); the rest sit behind the Pro row at a tab's end.
  const isPro = useIsPro();
  const { byTier, hiddenByTier, preview } = useMemo(() => {
    const byId = new Map((meals ?? []).map((m) => [m.id, m]));
    const ordered: Row[] = [];
    for (const t of TABS) {
      for (const match of results) {
        const meal = match.tier === t.tier ? byId.get(match.mealId) : undefined;
        if (meal) ordered.push({ match, meal, order: ordered.length });
      }
    }
    const visible = isPro ? ordered : ordered.filter((r) => r.order < FREE_RESULTS_CAP);
    const hidden = isPro ? [] : ordered.filter((r) => r.order >= FREE_RESULTS_CAP);
    const group = (rows: Row[]) =>
      Object.fromEntries(TABS.map((t) => [t.tier, rows.filter((r) => r.match.tier === t.tier)])) as Record<MatchTier, Row[]>;
    return { byTier: group(visible), hiddenByTier: group(hidden), preview: hidden.slice(0, 3).map((r) => r.meal) };
  }, [results, meals, isPro]);

  // Opens on the readiest tab with anything in it.
  const firstTab = TABS.find((t) => tierCounts[t.tier] > 0)?.tier ?? "cookNow";
  const [tab, setTab] = useState<MatchTier | null>(null);
  const current = tab ?? firstTab;
  const tabInfo = TABS.find((t) => t.tier === current)!;
  const rows = byTier[current];
  const hiddenHere = hiddenByTier[current].length;

  // "I have it": the chip shows its check, then the ingredient joins the
  // pantry and the meal re-sorts into the tab it now fits.
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const haveIt = (ing: MissingIngredient) => {
    void Haptics.selectionAsync();
    setJustAdded((prev) => new Set(prev).add(ing.id));
    setTimeout(
      () => {
        pantryActions.add({ id: ing.id, name: ing.name });
        void pantryActions.persist();
        setJustAdded((prev) => {
          const next = new Set(prev);
          next.delete(ing.id);
          return next;
        });
      },
      reduce ? 0 : HAVE_IT_MS,
    );
  };

  return (
    <Screen padded={false}>
      <View className="flex-row items-start gap-3 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="h-8 justify-center" accessibilityLabel="Back">
          <ArrowLeft color={colors.ink.emphasis} size={20} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="sectionTitle" dot>
            Meals you can cook
          </AppText>
          <Text className="mt-0.5 font-inter-regular text-body text-ink-subtle">
            From {pantry.length} ingredient{pantry.length === 1 ? "" : "s"} in your pantry
          </Text>
        </View>
      </View>

      {matching || loadingMeals ? (
        <LoadingState label="Finding meals…" />
      ) : results.length === 0 ? (
        <Text className="px-5 py-10 text-center font-inter-regular text-body text-ink-subtle">
          No meals use these ingredients yet. Try adding a few more.
        </Text>
      ) : (
        <>
          <View className="px-5">
            <SegmentedSwitch
              size="md"
              options={TABS.map((t) => ({ value: t.tier, label: `${t.label} ${tierCounts[t.tier]}` }))}
              value={current}
              onChange={(t) => {
                void Haptics.selectionAsync();
                setTab(t);
              }}
            />
            <Text className="mt-3 font-inter-regular text-small text-ink-subtle">{tabInfo.blurb}</Text>
          </View>
          <FlatList
            key={current}
            data={rows}
            keyExtractor={(row) => row.match.mealId}
            contentContainerClassName="px-5 pb-10 pt-1"
            ListEmptyComponent={
              <Text className="py-10 text-center font-inter-regular text-body text-ink-subtle">
                {hiddenHere > 0 ? "" : "Nothing here yet."}
              </Text>
            }
            ListFooterComponent={
              hiddenHere > 0 ? (
                <View className="mt-3">
                  <SeeAllMatchesCard hiddenCount={hiddenHere} preview={preview} variant="row" />
                </View>
              ) : undefined
            }
            renderItem={({ item, index }) => (
              <Animated.View
                entering={reduce ? FadeIn.duration(150) : FadeInDown.delay(Math.min(index, ROW_STAGGER_CAP) * ROW_STAGGER_MS).duration(300).easing(EASE)}
                exiting={reduce ? undefined : FadeOut.duration(220)}
                layout={reduce ? undefined : LinearTransition.duration(240)}
              >
                <MatchRow
                  meal={item.meal}
                  match={item.match}
                  last={index === rows.length - 1 && hiddenHere === 0}
                  saved={!!savedMeals.savedFor(item.meal)}
                  justAdded={justAdded}
                  onToggleSave={() => void savedMeals.toggle(item.meal)}
                  onHaveIt={haveIt}
                  onPress={() => detail.open(item.meal.id)}
                />
              </Animated.View>
            )}
          />
        </>
      )}

      <MealDetailSheet meal={detail.meal} onClose={detail.close} />
    </Screen>
  );
}

// How much of the meal you have, one dot per ingredient: filled for what's
// in your pantry, hollow for what's missing.
function Dots({ have, need }: { have: number; need: number }) {
  const total = have + need;
  return (
    <View className="flex-row items-center gap-1">
      {total <= MAX_DOTS &&
        Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: i < have ? colors.primary : colors.white,
              borderWidth: i < have ? 0 : 1.5,
              borderColor: colors.accent,
            }}
          />
        ))}
      <Text className={`font-inter-semibold text-sub text-ink-subtle ${total <= MAX_DOTS ? "ml-1.5" : ""}`}>
        {have} of {total}
      </Text>
    </View>
  );
}

function MatchRow({
  meal,
  match,
  last,
  saved,
  justAdded,
  onToggleSave,
  onHaveIt,
  onPress,
}: {
  meal: MealType;
  match: PantryMealMatch;
  last: boolean;
  saved: boolean;
  justAdded: Set<string>;
  onToggleSave: () => void;
  onHaveIt: (ing: MissingIngredient) => void;
  onPress: () => void;
}) {
  const shown = match.missing.slice(0, MISSING_SHOWN);
  const more = match.missing.length - shown.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${meal.name}, ${match.have} of ${match.have + match.need} ingredients${
        match.missing.length ? `, need ${match.missing.map((m) => pantryNameLower(m.name)).join(", ")}` : ""
      }`}
      className={`flex-row gap-3 py-3 active:opacity-80 ${last ? "" : "border-b border-ink-emphasis/5"}`}
    >
      <View style={{ width: PHOTO, height: PHOTO }} className="overflow-hidden rounded-2xl bg-ink-emphasis/5">
        <Image source={resolveMealImage(meal)} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View className="absolute bottom-1.5 left-1.5 rounded-full bg-ink-emphasis/75 px-2 py-0.5">
          <Text className="font-inter-extrabold text-sub text-white">{formatMealPrice(meal.price, meal.buffer_price)}</Text>
        </View>
      </View>

      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row items-start gap-2">
          <Text numberOfLines={2} className="flex-1 font-inter-bold text-body-lg text-ink-emphasis">
            {meal.name}
          </Text>
          <Pressable onPress={onToggleSave} hitSlop={10} accessibilityLabel={saved ? `Unsave ${meal.name}` : `Save ${meal.name}`}>
            <Bookmark color={colors.primary} fill={saved ? colors.primary : "none"} size={20} />
          </Pressable>
        </View>
        <Dots have={match.have} need={match.need} />
        {match.missing.length === 0 ? (
          <View className="flex-row items-center gap-1">
            <Check color={TIER_COLOR.cookNow} size={14} strokeWidth={3} />
            <Text className="font-inter-bold text-small" style={{ color: TIER_COLOR.cookNow }}>
              You have everything
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-1.5">
            {shown.map((ing) => {
              const added = justAdded.has(ing.id);
              return (
                <Pressable
                  key={ing.id}
                  onPress={() => !added && onHaveIt(ing)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`I have ${pantryNameLower(ing.name)}`}
                  className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
                    added ? "border-primary/30 bg-tinted-bg" : "border-accent/30 bg-accent/5 active:bg-accent/15"
                  }`}
                >
                  {added ? <Check color={colors.primary} size={12} strokeWidth={3} /> : <Plus color={colors.accent} size={12} strokeWidth={3} />}
                  <Text className={`font-inter-semibold text-sub ${added ? "text-primary" : "text-accent"}`}>{pantryName(ing.name)}</Text>
                </Pressable>
              );
            })}
            {more > 0 && (
              <Pressable onPress={onPress} hitSlop={4} className="rounded-full border border-ink-emphasis/10 px-2.5 py-1">
                <Text className="font-inter-semibold text-sub text-ink-subtle">+{more}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}
