import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { PantryChip } from "@/frontend/core/pantry/components/PantryChip";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";

// Pro: pick the ingredients you never want to see. Meals using any of them
// drop out of Suggest Meals, Browse and the Meal Planner (useAvoidFilter).
// Saved straight to preferences on every add/remove.
export function AvoidIngredientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();
  const avoided = prefs.avoid_ingredients;
  const avoidedIds = useMemo(() => new Set(avoided.map((a) => a.id)), [avoided]);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.8}>
      <View className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 pb-4 pt-10">
          <View>
            <AppText variant="sectionTitle" dot>
              Ingredients to avoid
            </AppText>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">
              Meals with these won&apos;t show in suggestions, Browse or your meal plan.
            </Text>
          </View>

          <IngredientSearch
            placeholder="Search ingredient…"
            disabledIds={avoidedIds}
            onPick={(ingredient) =>
              setPrefs({
                ...prefs,
                avoid_ingredients: [
                  ...avoided,
                  {
                    id: ingredient.id,
                    name: ingredient.canonical_name,
                    // The friendly and Filipino names too, so meals that only
                    // list ingredient names (e.g. "talong") still match.
                    aliases: [ingredient.display_name, ...(ingredient.aliases ?? [])].filter((a): a is string => !!a),
                  },
                ],
              })
            }
          />

          {avoided.length > 0 && (
            <View className="gap-2">
              <Text className="font-inter-regular text-small text-web-ink-muted">
                Avoiding {avoided.length} ingredient{avoided.length === 1 ? "" : "s"}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {avoided.map((item) => (
                  <PantryChip
                    key={item.id}
                    item={item}
                    onRemove={() => setPrefs({ ...prefs, avoid_ingredients: avoided.filter((a) => a.id !== item.id) })}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View className="px-5 pb-4 pt-2">
          <Button label="Done" onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
