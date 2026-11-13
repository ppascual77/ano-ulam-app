import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ShoppingBasket } from "lucide-react-native";
import { Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { PANTRY_MIN_FOR_SUGGESTIONS, type PantryIngredient } from "../types";
import { usePantryMatches, type MatchTier, type PantryMealMatch } from "../hooks/usePantryMatches";
import { usePantryResultsGate } from "../hooks/usePantryResultsGate";
import { pantryNameLower } from "../pantryName";

const EASE = Easing.out(Easing.cubic);
// The readiness colors: ready, nearly, a trip (same as the results tabs).
export const TIER_COLOR: Record<MatchTier, string> = { cookNow: colors.trend.down, almost: colors.trend.flat, trip: colors.accent };
const TIER_TITLE: Record<MatchTier, string> = { cookNow: "Cook now", almost: "Almost", trip: "Need a trip" };
const TIERS: MatchTier[] = ["cookNow", "almost", "trip"];
const PHOTO = 54;
const SPOT = 76;
// At or below this many lead meals, spotlight the meal instead of a count.
const SPOTLIGHT_MAX = 2;
// The fan: each photo's resting tilt and offset (back to front).
const FAN = [
  { rotate: -10, x: -24, y: 6 },
  { rotate: 9, x: 22, y: 4 },
  { rotate: -2, x: 0, y: -6 },
];

// The cook-now meals' photos, fanned, settling in one after another.
function FanPhoto({ uri, index, reduce }: { uri: string; index: number; reduce: boolean }) {
  const k = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) k.value = withDelay(150 + index * 70, withTiming(1, { duration: 480, easing: EASE }));
  }, [k, index, reduce]);
  const { rotate, x, y } = FAN[index];
  const style = useAnimatedStyle(() => ({
    opacity: k.value,
    transform: [{ translateX: x * k.value }, { translateY: y * k.value }, { rotate: `${rotate * k.value}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", width: PHOTO, height: PHOTO }, style]}>
      <View className="flex-1 overflow-hidden rounded-2xl border-2 border-white bg-ink-emphasis/5 shadow-sm">
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
      </View>
    </Animated.View>
  );
}

// The matches split by readiness: three equal columns, so a lone "1" reads
// as clearly as "76" (a proportional bar shrank small counts to slivers).
function TierStats({ counts, lead }: { counts: Record<MatchTier, number>; lead: MatchTier }) {
  return (
    <View className="flex-row rounded-2xl bg-white py-3">
      {TIERS.map((t, i) => (
        <View key={t} className={`flex-1 items-center gap-1.5 ${i > 0 ? "border-l border-ink-emphasis/10" : ""} ${counts[t] === 0 ? "opacity-40" : ""}`}>
          <Text className={`font-inter-extrabold text-subheading tracking-display ${t === lead ? "text-ink-emphasis" : "text-ink"}`}>{counts[t]}</Text>
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TIER_COLOR[t] }} />
            <Text className="font-inter-semibold text-sub text-ink-subtle">{TIER_TITLE[t]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// One or two ready meals: show the meal itself (photo, name, what it still
// needs) instead of a lonely count, so "1" feels like a dinner idea.
function Spotlight({ meal, match, others, reduce }: { meal: MealType; match: PantryMealMatch; others: number; reduce: boolean }) {
  const k = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) k.value = withDelay(120, withTiming(1, { duration: 480, easing: EASE }));
  }, [k, reduce]);
  const photoStyle = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ scale: 0.92 + 0.08 * k.value }, { rotate: `${-3 * k.value}deg` }] }));
  const missing = match.missing.map((m) => pantryNameLower(m.name));
  const detail =
    match.tier === "cookNow"
      ? missing.length === 0
        ? "You have everything for it."
        : `Just add ${joinAnd(missing)}.`
      : `Just need ${joinAnd(missing)}.`;
  return (
    <View className="mt-3 flex-row items-center gap-4">
      <Animated.View style={[{ width: SPOT, height: SPOT }, photoStyle]}>
        <View className="flex-1 overflow-hidden rounded-2xl border-2 border-white bg-ink-emphasis/5 shadow-sm">
          <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        </View>
      </Animated.View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TIER_COLOR[match.tier] }} />
          <Text className="font-inter-bold text-sub uppercase tracking-widest text-ink-emphasis">
            {match.tier === "cookNow" ? "Ready to cook" : "Almost ready"}
          </Text>
        </View>
        <Text numberOfLines={2} className="mt-1.5 font-inter-extrabold text-heading tracking-display text-ink-emphasis">
          {meal.name}
        </Text>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">
          {detail}
          {others > 0 ? ` +${others} more ${match.tier === "cookNow" ? "ready" : "close"}.` : ""}
        </Text>
      </View>
    </View>
  );
}

// "What can you make?": how many catalog meals you can cook right now (with
// their photos), all matches split by readiness, and a way to see them;
// then, when one ingredient would unlock more, which one to buy.
export function PantryMatchCard({ pantry }: { pantry: PantryIngredient[] }) {
  const { matchedMeals, results, tierCounts, unlock, isLoading } = usePantryMatches(pantry);
  const { data: meals } = useRealMeals();
  const reduce = useReduceMotion();
  const needed = PANTRY_MIN_FOR_SUGGESTIONS - pantry.length;
  const ready = needed <= 0;

  // The count and split stay free; opening the meals counts toward the
  // daily limit (usePantryResultsGate).
  const gate = usePantryResultsGate();

  const byId = useMemo(() => new Map((meals ?? []).map((m) => [m.id, m])), [meals]);
  const photos = useMemo(() => {
    const lead = results.filter((r) => r.tier === tierToShow(tierCounts)).map((r) => byId.get(r.mealId)?.image_url);
    return lead.filter((u): u is string => !!u).slice(0, FAN.length);
  }, [results, tierCounts, byId]);
  const unlockNames = unlock?.mealIds.map((id) => byId.get(id)?.name).filter(Boolean) ?? [];

  const lead = tierToShow(tierCounts);
  const leadCount = tierCounts[lead];
  const leadMatch = results.find((r) => r.tier === lead);
  const leadMeal = leadMatch ? byId.get(leadMatch.mealId) : undefined;
  const spotlight = ready && !isLoading && lead !== "trip" && leadCount <= SPOTLIGHT_MAX && leadMatch && leadMeal;
  const headline = lead === "cookNow" ? "you can cook now" : lead === "almost" ? "almost ready to cook" : "use what you have";

  return (
    <View className="gap-3">
      <View className="overflow-hidden rounded-3xl bg-mood-bg p-5">
        <View className="flex-row">
          <View className="flex-1 pr-2">
            <Text className="font-inter-bold text-sub uppercase tracking-widest text-ink-subtle">What can you make?</Text>
            {!ready ? (
              <Text className="mt-1 font-inter-extrabold text-subheading tracking-display text-ink-emphasis">
                Add {needed} more ingredient{needed === 1 ? "" : "s"} to see your meals
              </Text>
            ) : isLoading ? (
              <Text className="mt-1 font-inter-extrabold text-subheading text-ink-emphasis">Finding meals…</Text>
            ) : matchedMeals === 0 ? (
              <Text className="mt-1 font-inter-extrabold text-subheading tracking-display text-ink-emphasis">
                No meals use these yet. Try adding a few more.
              </Text>
            ) : spotlight ? null : (
              <Text className="mt-1 font-inter-extrabold text-heading tracking-display text-ink-emphasis">
                <Text style={{ color: TIER_COLOR[lead] }}>
                  {leadCount} meal{leadCount === 1 ? "" : "s"}
                </Text>
                {"\n"}
                {headline}
              </Text>
            )}
          </View>
          {ready && !spotlight && photos.length > 0 && (
            <View className="h-20 w-24 items-center justify-center">
              {photos.map((uri, i) => (
                <FanPhoto key={uri} uri={uri} index={i} reduce={reduce} />
              ))}
            </View>
          )}
        </View>

        {spotlight && <Spotlight meal={leadMeal} match={leadMatch} others={leadCount - 1} reduce={reduce} />}

        {ready && !isLoading && matchedMeals > 0 && (
          <View className="mt-4">
            <TierStats counts={tierCounts} lead={lead} />
          </View>
        )}

        <View className="mt-4">
          <Button
            label="See what to cook"
            shape="fullPill"
            onPress={() => void gate.openResults(pantry)}
            disabled={!ready || matchedMeals === 0}
          />
        </View>
        {ready && gate.hint && <View className="mt-2">{gate.hint}</View>}
        {gate.limitSheet}
      </View>

      {ready && unlock && unlockNames.length > 0 && (
        <View className="flex-row items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <ShoppingBasket color={colors.accent} size={16} />
          </View>
          <Text className="flex-1 font-inter-regular text-small text-ink-emphasis">
            Buy <Text className="font-inter-bold">{pantryNameLower(unlock.ingredient.name)}</Text> and you can cook{" "}
            <Text className="font-inter-bold">{unlockNames.length} more</Text>: {unlockNames.slice(0, 3).join(", ")}
            {unlockNames.length > 3 ? "…" : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

// The headline leads with the readiest tier that has any meals.
function tierToShow(counts: Record<MatchTier, number>): MatchTier {
  return counts.cookNow > 0 ? "cookNow" : counts.almost > 0 ? "almost" : "trip";
}

// "salt", "salt and pepper", "salt, pepper and garlic".
function joinAnd(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
