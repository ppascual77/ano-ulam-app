import { useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ArrowLeft, Bookmark, ChevronRight, Clock, Flame, ShoppingBag, ShoppingCart, UtensilsCrossed } from "lucide-react-native";
import { LoadingState, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useMealDetail } from "@/frontend/core/meals/hooks/useMealDetail";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { usePantryMatches, type MatchTier, type PantryMealMatch } from "@/frontend/core/pantry/hooks/usePantryMatches";

// Motion: sections land in order (Cook now first), cards slide up one after
// another within that order, then each card's ingredient bar fills to how
// much of the meal you have. No bounce here: springs are kept for
// selection moments (tabs, toggles).
const CARD_STAGGER_MS = 60;
const CARD_STAGGER_CAP = 10; // cards past this land together, not seconds later
const BAR_START_MS = 220; // after the card lands
const BAR_FILL_MS = 600;
const MISSING_SHOWN = 3;
const PHOTO_WIDTH = 116;
const PHOTO_MIN_HEIGHT = 130;

const SECTIONS: { tier: MatchTier; title: string; blurb: string }[] = [
  { tier: "cookNow", title: "Cook now", blurb: "You have everything, or just a basic or two" },
  { tier: "almost", title: "Almost there", blurb: "Missing one or two ingredients" },
  { tier: "trip", title: "Worth a palengke trip", blurb: "You'll need a few more things" },
];

type Row = { match: PantryMealMatch; meal: MealType; order: number };

// "See meals": every catalog meal that uses something in the pantry, grouped
// by how ready it is to cook, each naming what's missing. Reads the shared
// pantry directly, so it's current whether opened from Home or Profile.
export default function PantryResultsScreen() {
  const { data: pantry = [] } = usePantry();
  const { matchedMeals, averageMatch, results, isLoading: matching } = usePantryMatches(pantry);
  const { data: meals, isLoading: loadingMeals } = useRealMeals();
  const detail = useMealDetail();
  // The bookmark saves the meal.
  const savedMeals = useSavedMealActions();
  const [toast, setToast] = useState<ToastState | null>(null);
  const toggleSave = async (meal: MealType) => {
    const wasSaved = !!savedMeals.savedFor(meal);
    const error = await savedMeals.toggle(meal);
    setToast({ id: Date.now(), tone: error ? "error" : "success", message: error ?? (wasSaved ? "Removed from saved meals" : "Saved to your meals") });
  };

  // Matches paired with their meal's card info, split into readiness
  // sections. `order` runs across sections, for the landing stagger.
  const sections = useMemo(() => {
    const byId = new Map((meals ?? []).map((m) => [m.id, m]));
    let order = 0;
    return SECTIONS.map((s) => ({
      ...s,
      data: results.flatMap((match): Row[] => {
        if (match.tier !== s.tier) return [];
        const meal = byId.get(match.mealId);
        return meal ? [{ match, meal, order: 0 }] : [];
      }),
    }))
      .filter((s) => s.data.length > 0)
      .map((s) => ({ ...s, data: s.data.map((row) => ({ ...row, order: order++ })) }));
  }, [results, meals]);

  return (
    <Screen padded={false}>
      <View className="flex-row items-start gap-3 border-b border-ink-emphasis/10 px-5 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="h-8 justify-center" accessibilityLabel="Back">
          <ArrowLeft color={colors.ink.emphasis} size={20} />
        </Pressable>
        <Text className="flex-1 font-inter-bold text-subheading text-ink-emphasis">
          Based on {pantry.length} ingredient{pantry.length === 1 ? "" : "s"} in your pantry
        </Text>
      </View>

      {matching || loadingMeals ? (
        <LoadingState label="Finding meals…" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.match.mealId}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="px-5 pb-10 pt-4"
          ListHeaderComponent={<Summary found={matchedMeals} averageMatch={averageMatch} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-inter-regular text-body text-ink-subtle">
              No meals use these ingredients yet. Try adding a few more.
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <Animated.View entering={FadeInDown.delay(stagger(section.data[0].order)).duration(300)}>
              <View className="mb-2 mt-5">
                <View className="flex-row items-center gap-2">
                  <Text className="font-inter-bold text-subheading text-ink-emphasis">{section.title}</Text>
                  <View className="rounded-full bg-primary/10 px-2 py-0.5">
                    <Text className="font-inter-semibold text-small text-primary">{section.data.length}</Text>
                  </View>
                </View>
                <Text className="mt-0.5 font-inter-regular text-body text-ink-subtle">{section.blurb}</Text>
              </View>
            </Animated.View>
          )}
          renderItem={({ item }) => (
            <View className="mb-3">
              <MatchCard
                meal={item.meal}
                match={item.match}
                delay={stagger(item.order)}
                saved={!!savedMeals.savedFor(item.meal)}
                onToggleSave={() => void toggleSave(item.meal)}
                onPress={() => detail.open(item.meal.id)}
              />
            </View>
          )}
        />
      )}

      <MealDetailSheet meal={detail.meal} onClose={detail.close} />
      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}

const stagger = (order: number) => Math.min(order, CARD_STAGGER_CAP) * CARD_STAGGER_MS;

function Summary({ found, averageMatch }: { found: number; averageMatch: number }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-ink-emphasis/10 bg-white p-4">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-mood-bg">
        <UtensilsCrossed color={colors.primary} size={20} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-bold text-subheading text-ink-emphasis">
          {found} meal{found === 1 ? "" : "s"} found
        </Text>
        <Text className="mt-0.5 font-inter-regular text-body text-ink-subtle">Great! You can make these with what you have.</Text>
      </View>
      <View className="items-end">
        <Text className="font-inter-extrabold text-heading text-primary">{averageMatch}%</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">Average match</Text>
      </View>
    </View>
  );
}

// How much of the meal you have: a bar that fills (after the card lands) to
// have / total.
function IngredientBar({ have, need, delay }: { have: number; need: number; delay: number }) {
  const total = have + need;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(delay + BAR_START_MS, withTiming(have / total, { duration: BAR_FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [have, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-2 flex-1 overflow-hidden rounded-full bg-primary/15">
      {/* Plain style on the animated fill (NativeWind can knock out
          Reanimated's animated values). */}
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, fillStyle]} />
    </View>
  );
}

// "Onion, red, raw" -> "onion": the part before the first comma, lowercased.
const shortName = (name: string) => name.split(",")[0].trim().toLowerCase();

// "Need: pineapple, potatoes, carrots" then "+5 more ›" (opens the meal).
function MissingLine({ missing, onMore }: { missing: PantryMealMatch["missing"]; onMore: () => void }) {
  if (missing.length === 0) {
    return <Text className="font-inter-semibold text-small text-primary">You have everything</Text>;
  }
  const names = missing.slice(0, MISSING_SHOWN).map((m) => shortName(m.name));
  const more = missing.length - names.length;
  return (
    <View>
      <Text numberOfLines={2} className="font-inter-regular text-small text-ink-subtle">
        <Text className="font-inter-semibold text-ink-emphasis">Need: </Text>
        {names.join(", ")}
      </Text>
      {more > 0 && (
        <Pressable onPress={onMore} hitSlop={6} className="mt-0.5 flex-row items-center gap-0.5 self-start">
          <Text className="font-inter-medium text-small text-ink-subtle">+{more} more</Text>
          <ChevronRight color={colors.ink.subtle} size={13} />
        </Pressable>
      )}
    </View>
  );
}

// Small tinted count chip: "5 in pantry" / "3 to buy".
function CountChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "have" | "buy" }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${tone === "have" ? "bg-tinted-bg" : "bg-category-breakfast"}`}>
      {icon}
      <Text className={`font-inter-semibold text-small ${tone === "have" ? "text-primary" : "text-accent"}`}>{label}</Text>
    </View>
  );
}

function MatchCard({
  meal,
  match,
  delay,
  saved,
  onToggleSave,
  onPress,
}: {
  meal: MealType;
  match: PantryMealMatch;
  delay: number;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
}) {
  const total = match.have + match.need;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${meal.name}, ${match.percent}% match${match.missing.length ? `, need ${match.missing.map((m) => shortName(m.name)).join(", ")}` : ""}`}
        className="flex-row gap-3 rounded-3xl border border-ink-emphasis/10 bg-white p-2.5 active:opacity-90"
      >
        {/* Photo fills the card's height, with the price on it. Absolutely
            positioned so the text column sets the height, not the image's
            own (huge) intrinsic size. */}
        <View style={{ width: PHOTO_WIDTH, minHeight: PHOTO_MIN_HEIGHT }} className="overflow-hidden rounded-2xl bg-ink-emphasis/5">
          <Image source={resolveMealImage(meal)} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View className="absolute bottom-2 left-2 rounded-full bg-ink-emphasis/75 px-2 py-1">
            <Text className="font-inter-extrabold text-small text-white">
              ₱{meal.price}
              {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
            </Text>
          </View>
        </View>

        <View className="flex-1 gap-2 py-1 pr-1">
          <View className="flex-row items-start gap-2">
            <Text numberOfLines={2} className="flex-1 font-inter-bold text-body-lg text-ink-emphasis">
              {meal.name}
            </Text>
            <Pressable onPress={onToggleSave} hitSlop={10} accessibilityLabel={saved ? `Unsave ${meal.name}` : `Save ${meal.name}`}>
              <Bookmark color={colors.primary} fill={saved ? colors.primary : "none"} size={20} />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-2">
            <IngredientBar have={match.have} need={match.need} delay={delay} />
            <View className="items-end">
              <Text className="font-inter-extrabold text-subheading text-primary">{match.percent}%</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">
                {match.have} of {total}
              </Text>
            </View>
          </View>

          <MissingLine missing={match.missing} onMore={onPress} />

          <View className="flex-row flex-wrap gap-2">
            <CountChip icon={<ShoppingCart color={colors.primary} size={13} />} label={`${match.have} in pantry`} tone="have" />
            {match.need > 0 && <CountChip icon={<ShoppingBag color={colors.accent} size={13} />} label={`${match.need} to buy`} tone="buy" />}
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Flame color={colors.like} fill={colors.like} size={14} />
              <Text className="font-inter-semibold text-small text-like">{Math.round(meal.calories)} cal</Text>
            </View>
            {meal.prep_time != null && (
              <>
                <View className="h-4 w-px bg-ink-emphasis/15" />
                <View className="flex-row items-center gap-1">
                  <Clock color={colors.ink.subtle} size={14} />
                  <Text className="font-inter-semibold text-small text-ink-subtle">{meal.prep_time} min</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
