import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ShoppingBasket } from "lucide-react-native";
import { Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { PANTRY_MIN_FOR_SUGGESTIONS, type PantryIngredient } from "../types";
import { usePantryMatches, type MatchTier } from "../hooks/usePantryMatches";
import { usePantryResultsGate } from "../hooks/usePantryResultsGate";
import { pantryNameLower } from "../pantryName";

const EASE = Easing.out(Easing.cubic);
// The readiness colors: ready, nearly, a trip (same as the results tabs).
export const TIER_COLOR: Record<MatchTier, string> = { cookNow: colors.trend.down, almost: colors.trend.flat, trip: colors.accent };
export const TIER_LABEL: Record<MatchTier, string> = { cookNow: "cook now", almost: "almost", trip: "need a trip" };
const TIERS: MatchTier[] = ["cookNow", "almost", "trip"];
const PHOTO = 54;
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

// The matches split by readiness, as one bar that grows in from the left.
function TierBar({ counts, total }: { counts: Record<MatchTier, number>; total: number }) {
  const reduce = useReduceMotion();
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    grow.value = reduce ? 1 : withTiming(1, { duration: 620, easing: EASE });
  }, [grow, reduce, total]);
  const style = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <View>
      <Animated.View style={[{ flexDirection: "row", gap: 4, height: 10 }, style]}>
        {TIERS.filter((t) => counts[t] > 0).map((t) => (
          <View key={t} style={{ flex: counts[t], borderRadius: 999, backgroundColor: TIER_COLOR[t] }} />
        ))}
      </Animated.View>
      <View className="mt-2 flex-row justify-between">
        {TIERS.map((t) => (
          <View key={t} className="flex-row items-center gap-1.5">
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLOR[t] }} />
            <Text className="font-inter-semibold text-sub text-ink-subtle">
              {counts[t]} {TIER_LABEL[t]}
            </Text>
          </View>
        ))}
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
            ) : (
              <Text className="mt-1 font-inter-extrabold text-heading tracking-display text-ink-emphasis">
                <Text style={{ color: TIER_COLOR[lead] }}>
                  {leadCount} meal{leadCount === 1 ? "" : "s"}
                </Text>
                {"\n"}
                {headline}
              </Text>
            )}
          </View>
          {ready && photos.length > 0 && (
            <View className="h-20 w-24 items-center justify-center">
              {photos.map((uri, i) => (
                <FanPhoto key={uri} uri={uri} index={i} reduce={reduce} />
              ))}
            </View>
          )}
        </View>

        {ready && !isLoading && matchedMeals > 0 && (
          <View className="mt-4">
            <TierBar counts={tierCounts} total={matchedMeals} />
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

