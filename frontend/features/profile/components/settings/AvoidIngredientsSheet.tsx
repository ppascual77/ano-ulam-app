import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ChevronRight, EyeOff, Plus, X } from "lucide-react-native";
import { RollingText, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getIngredientsForMatching } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";
import type { AvoidedIngredient } from "@/api/auth";
import { IngredientSearch, searchIngredients } from "@/frontend/core/meals/components/IngredientSearch";
import { avoidLabel, baseOf, entryMatches, familyMatches, isCovered, suggestFamily } from "@/frontend/core/preferences/avoidMatch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useAvoidImpact } from "@/frontend/core/preferences/hooks/useAvoidImpact";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProSettingSheet } from "./ProSettingSheet";

// Foods people often leave out, offered as one-tap picks. Each becomes the
// whole food (all pork, all shrimp...) when the catalog has several kinds.
const COMMON_PICKS = ["pork", "beef", "chicken", "shrimp", "crab", "squid", "peanuts", "ampalaya", "eggplant", "liver"];

const EASE = Easing.out(Easing.cubic);

const exact = (ingredient: IngredientRow): AvoidedIngredient => ({
  id: ingredient.id,
  name: ingredient.canonical_name,
  // The friendly and Filipino names too, so meals that only list ingredient
  // names (e.g. "talong") can still match.
  aliases: [ingredient.display_name, ...(ingredient.aliases ?? [])].filter((a): a is string => !!a),
});
const wholeFood = (ingredient: IngredientRow, family: string): AvoidedIngredient => ({
  id: ingredient.id,
  name: ingredient.canonical_name,
  aliases: [],
  family,
});

/** "Chicken wing, raw" -> "Chicken wing" (the friendly name if it has one). */
const shortName = (ingredient: IngredientRow) => ingredient.display_name ?? ingredient.canonical_name.split(",")[0];

// A picked ingredient whose food has several kinds: "all of it, or just this?"
type ScopeChoice = { ingredient: IngredientRow; family: string; members: IngredientRow[] };

// One way to avoid it, in the scope choice: a full-width tappable row.
function ScopeOption({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-ink-emphasis/10 bg-white px-4 py-3.5 active:bg-ink-emphasis/5"
    >
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{title}</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronRight color={colors.ink.subtle} size={18} />
    </Pressable>
  );
}

// Pro: the ingredients you never want to see in meals. Saved as you go
// (useAvoidFilter hides those meals everywhere): a live count of what's
// hidden, search, the list (each row with how many meals it takes out) and
// common picks. An entry is one ingredient or a whole food: picking a
// chicken cut asks "All chicken" or "Just chicken wing"; common picks are the
// whole food. Rows slide in, fade out and the rest reflow; removing one
// offers Undo.
export function AvoidIngredientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const reduceMotion = useReduceMotion();
  const avoided = prefs.avoid_ingredients;
  const impact = useAvoidImpact(avoided);
  const [choice, setChoice] = useState<ScopeChoice | null>(null);

  const { data: catalog } = useQuery({ queryKey: ["ingredients", "matching"], queryFn: getIngredientsForMatching, staleTime: 10 * 60 * 1000 });

  // Ingredients already covered (exactly or by a whole food): "Added" in search.
  const coveredIds = useMemo(
    () => new Set((catalog ?? []).filter((ingredient) => isCovered(avoided, ingredient)).map((i) => i.id)),
    [catalog, avoided],
  );

  const picks = useMemo(() => {
    if (!catalog) return [];
    const seen = new Set<string>();
    return COMMON_PICKS.flatMap((term) => {
      // A word with several kinds ("pork") is the whole food; otherwise the
      // best match by name ("ampalaya" -> Bitter gourd), raw and cooked.
      const members = catalog.filter((i) => familyMatches(term, i));
      const match = members.length > 1 ? members[0] : searchIngredients(term, catalog, 1)[0];
      if (!match) return [];
      const entry = members.length > 1 ? wholeFood(match, term) : exact(match);
      const key = entry.family ?? baseOf(entry.name);
      if (seen.has(key) || members.concat(match).every((i) => coveredIds.has(i.id))) return [];
      seen.add(key);
      return [entry];
    });
  }, [catalog, coveredIds]);

  // Newest first. A whole food replaces the exact entries it covers. Changes
  // start from the latest list, so a quick add and remove (or a late Undo)
  // never drops one.
  const add = (entry: AvoidedIngredient) => {
    void Haptics.selectionAsync();
    setChoice(null);
    update((current) => {
      // Drop what the new entry already covers (the same food, or foods in
      // a whole food being added).
      const rest = current.avoid_ingredients.filter((a) =>
        a.family
          ? a.family !== entry.family
          : entry.family
            ? !familyMatches(entry.family, { id: a.id, canonical_name: a.name })
            : baseOf(a.name) !== baseOf(entry.name),
      );
      return { ...current, avoid_ingredients: [entry, ...rest] };
    });
  };
  const pick = (ingredient: IngredientRow) => {
    const whole = catalog ? suggestFamily(ingredient, catalog) : null;
    if (whole && !avoided.some((a) => a.family === whole.family)) setChoice({ ingredient, ...whole });
    else add(exact(ingredient));
  };
  const remove = (item: AvoidedIngredient) => {
    void Haptics.selectionAsync();
    const at = avoided.findIndex((a) => a.id === item.id);
    update((current) => ({ ...current, avoid_ingredients: current.avoid_ingredients.filter((a) => a.id !== item.id) }));
    showGlobalToast({
      message: `${avoidLabel(item)} is back in your meals`,
      tone: "success",
      action: {
        label: "Undo",
        inSheet: true,
        onPress: () =>
          update((current) => {
            if (current.avoid_ingredients.some((a) => a.id === item.id)) return current;
            const list = [...current.avoid_ingredients];
            list.splice(Math.min(Math.max(at, 0), list.length), 0, item);
            return { ...current, avoid_ingredients: list };
          }),
      },
    });
  };

  const layout = reduceMotion ? undefined : LinearTransition.duration(240).easing(EASE);
  const enter = reduceMotion ? FadeIn.duration(150) : FadeInDown.duration(240).easing(EASE);
  const exit = FadeOut.duration(150);

  // "18 kinds: thigh, drumstick, wing and 12 more" for the whole-food option.
  const kindsLine = (c: ScopeChoice) => {
    const names = c.members
      .map((m) => baseOf(m.canonical_name).replace(new RegExp(`\\b${c.family.replace(/s$/, "")}s?\\b`), "").trim())
      .filter((n, i, all) => n && all.indexOf(n) === i);
    const shown = names.slice(0, 3).join(", ");
    return `${c.members.length} kinds${shown ? `: ${shown}` : ""}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
  };

  return (
    <ProSettingSheet
      visible={visible}
      title="Ingredients to avoid"
      subtitle="Meals with these never show up: suggestions, Browse, recommendations or your meal plan."
      actionLabel="Done"
      onAction={onClose}
      onClose={onClose}
    >
      {/* What the list takes out, rolling as it changes. */}
      <View className="flex-row items-center gap-3 rounded-2xl bg-notice-positive-bg px-4 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
          <EyeOff color={colors.primary} size={20} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <RollingText value={impact.hidden} rank={impact.hidden} className="font-inter-extrabold text-heading text-ink-emphasis" />
            <Text className="font-inter-semibold text-body text-ink-emphasis">{impact.hidden === 1 ? "meal hidden" : "meals hidden"}</Text>
          </View>
          <Text className="font-inter-regular text-small text-ink-subtle">
            {avoided.length === 0
              ? "Add an ingredient to start."
              : `${impact.total > 0 ? `Out of ${impact.total} meals` : "From the catalog"} · ${avoided.length} ${avoided.length === 1 ? "item" : "items"}`}
          </Text>
        </View>
      </View>

      {/* Search, or (after picking a food with several kinds) the choice. */}
      {choice ? (
        <Animated.View key={`choice-${choice.ingredient.id}`} entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <View className="gap-2.5 rounded-2xl bg-ink-emphasis/5 p-3">
            <Text className="px-1 font-inter-semibold text-body text-ink-emphasis">Avoid {shortName(choice.ingredient).toLowerCase()}?</Text>
            <ScopeOption title={`All ${choice.family}`} detail={kindsLine(choice)} onPress={() => add(wholeFood(choice.ingredient, choice.family))} />
            <ScopeOption title={`Just ${shortName(choice.ingredient).toLowerCase()}`} detail="Only this one" onPress={() => add(exact(choice.ingredient))} />
            <Pressable onPress={() => setChoice(null)} hitSlop={8} className="items-center py-1.5 active:opacity-60">
              <Text className="font-inter-medium text-small text-ink-subtle">Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="search" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <IngredientSearch placeholder="Search an ingredient to avoid…" disabledIds={coveredIds} onPick={pick} />
        </Animated.View>
      )}

      {avoided.length > 0 && (
        <Animated.View layout={layout}>
          <Text className="mb-2 font-inter-bold text-small uppercase text-ink-subtle">You avoid</Text>
          <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10">
            {avoided.map((item, i) => {
              const meals = impact.perEntry.get(item.id) ?? 0;
              const kinds = item.family ? (catalog ?? []).filter((ingredient) => entryMatches(item, ingredient)).length : 0;
              const mealsText = impact.loading ? "" : meals === 0 ? "Not in any meal yet" : `In ${meals} ${meals === 1 ? "meal" : "meals"}`;
              return (
                <Animated.View key={item.id} entering={enter} exiting={exit} layout={layout}>
                  <View className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}>
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-body text-ink-emphasis" numberOfLines={1}>
                        {avoidLabel(item)}
                      </Text>
                      <Text className="font-inter-regular text-small text-ink-subtle">
                        {[item.family && kinds > 0 ? `${kinds} kinds` : null, mealsText].filter(Boolean).join(" · ") || " "}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => remove(item)}
                      hitSlop={8}
                      accessibilityLabel={`Stop avoiding ${avoidLabel(item)}`}
                      className="h-8 w-8 items-center justify-center rounded-full bg-ink-emphasis/5 active:bg-ink-emphasis/10"
                    >
                      <X color={colors.ink.subtle} size={14} />
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {picks.length > 0 && (
        <Animated.View layout={layout}>
          <Text className="mb-2 font-inter-bold text-small uppercase text-ink-subtle">Common picks</Text>
          <View className="flex-row flex-wrap gap-2">
            {picks.map((item) => {
              const label = item.family ? item.family.charAt(0).toUpperCase() + item.family.slice(1) : avoidLabel(item);
              return (
                <Animated.View key={item.family ?? item.id} entering={FadeIn.duration(180)} exiting={exit} layout={layout}>
                  <Pressable
                    onPress={() => add(item)}
                    accessibilityLabel={`Avoid ${item.family ? `all ${item.family}` : label}`}
                    className="flex-row items-center gap-1.5 rounded-full border border-ink-emphasis/15 px-3 py-2 active:bg-ink-emphasis/5"
                  >
                    <Plus color={colors.ink.subtle} size={13} />
                    <Text className="font-inter-medium text-small text-ink-emphasis">{label}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}
    </ProSettingSheet>
  );
}
