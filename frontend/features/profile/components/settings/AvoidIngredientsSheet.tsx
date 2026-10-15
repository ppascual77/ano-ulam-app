import { useMemo } from "react";
import { Text, View } from "react-native";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { PantryChip } from "@/frontend/core/pantry/components/PantryChip";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ProSettingSheet } from "./ProSettingSheet";

// Pro: the ingredients you never want to see in suggestions. Saved straight
// to preferences on every add/remove (not acted on anywhere yet).
export function AvoidIngredientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();
  const avoided = prefs.avoid_ingredients;
  const avoidedIds = useMemo(() => new Set(avoided.map((a) => a.id)), [avoided]);

  return (
    <ProSettingSheet
      visible={visible}
      title="Ingredients to avoid"
      subtitle="Meals with these won't show in suggestions, Browse or your meal plan."
      actionLabel="Done"
      onAction={onClose}
      onClose={onClose}
    >
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
                // list ingredient names (e.g. "talong") can still match.
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
    </ProSettingSheet>
  );
}
