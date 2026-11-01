import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { EyeOff, Plus, X } from "lucide-react-native";
import { RollingText, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { getIngredientsForMatching } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";
import type { AvoidedIngredient } from "@/api/auth";
import { IngredientSearch, searchIngredients } from "@/frontend/core/meals/components/IngredientSearch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useAvoidImpact } from "@/frontend/core/preferences/hooks/useAvoidImpact";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProSettingSheet } from "./ProSettingSheet";

// Ingredients people often leave out, offered as one-tap picks (each
// resolved to the best catalog match; ones not in the catalog are skipped).
const COMMON_PICKS = ["pork", "beef", "shrimp", "crab", "squid", "peanut", "ampalaya", "eggplant", "okra", "liver"];

const EASE = Easing.out(Easing.cubic);

/** The friendly name when there is one, else "Pork belly, raw" -> "Pork belly". */
export const avoidLabel = (a: Pick<AvoidedIngredient, "name" | "aliases">) => a.aliases[0] ?? a.name.split(",")[0];

const toAvoided = (ingredient: IngredientRow): AvoidedIngredient => ({
  id: ingredient.id,
  name: ingredient.canonical_name,
  // The friendly and Filipino names too, so meals that only list ingredient
  // names (e.g. "talong") can still match.
  aliases: [ingredient.display_name, ...(ingredient.aliases ?? [])].filter((a): a is string => !!a),
});

// Pro: the ingredients you never want to see in meals. Saved as you go
// (useAvoidFilter hides those meals everywhere): a live count of what's
// hidden, search, the list (each row with how many meals it takes out) and
// common picks. Rows slide in, fade out and the rest reflow smoothly;
// removing one offers Undo.
export function AvoidIngredientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const reduceMotion = useReduceMotion();
  const avoided = prefs.avoid_ingredients;
  const ids = useMemo(() => avoided.map((a) => a.id), [avoided]);
  const avoidedIds = useMemo(() => new Set(ids), [ids]);
  const impact = useAvoidImpact(ids);

  const { data: catalog } = useQuery({ queryKey: ["ingredients", "matching"], queryFn: getIngredientsForMatching, staleTime: 10 * 60 * 1000 });
  const picks = useMemo(() => {
    if (!catalog) return [];
    const seen = new Set<string>();
    return COMMON_PICKS.flatMap((term) => {
      const match = searchIngredients(term, catalog, 1)[0];
      if (!match || seen.has(match.id) || avoidedIds.has(match.id)) return [];
      seen.add(match.id);
      return [toAvoided(match)];
    });
  }, [catalog, avoidedIds]);

  // Newest first. Changes start from the latest list, so a quick add and
  // remove (or a late Undo) never drops one.
  const add = (item: AvoidedIngredient) => {
    if (avoidedIds.has(item.id)) return;
    void Haptics.selectionAsync();
    update((current) => ({ ...current, avoid_ingredients: [item, ...current.avoid_ingredients.filter((a) => a.id !== item.id)] }));
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
              : `${impact.total > 0 ? `Out of ${impact.total} meals` : "From the catalog"} · ${avoided.length} ${avoided.length === 1 ? "ingredient" : "ingredients"}`}
          </Text>
        </View>
      </View>

      <IngredientSearch placeholder="Search an ingredient to avoid…" disabledIds={avoidedIds} onPick={(ingredient) => add(toAvoided(ingredient))} />

      {avoided.length > 0 && (
        <Animated.View layout={layout}>
          <Text className="mb-2 font-inter-bold text-small uppercase text-ink-subtle">You avoid</Text>
          <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10">
            {avoided.map((item, i) => {
              const meals = impact.perIngredient.get(item.id) ?? 0;
              return (
                <Animated.View key={item.id} entering={enter} exiting={exit} layout={layout}>
                  <View className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}>
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-body text-ink-emphasis" numberOfLines={1}>
                        {avoidLabel(item)}
                      </Text>
                      <Text className="font-inter-regular text-small text-ink-subtle">
                        {impact.loading ? " " : meals === 0 ? "Not in any meal yet" : `In ${meals} ${meals === 1 ? "meal" : "meals"}`}
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
            {picks.map((item) => (
              <Animated.View key={item.id} entering={FadeIn.duration(180)} exiting={exit} layout={layout}>
                <Pressable
                  onPress={() => add(item)}
                  accessibilityLabel={`Avoid ${avoidLabel(item)}`}
                  className="flex-row items-center gap-1.5 rounded-full border border-ink-emphasis/15 px-3 py-2 active:bg-ink-emphasis/5"
                >
                  <Plus color={colors.ink.subtle} size={13} />
                  <Text className="font-inter-medium text-small text-ink-emphasis">{avoidLabel(item)}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}
    </ProSettingSheet>
  );
}
