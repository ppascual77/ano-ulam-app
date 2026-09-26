import { Text, View } from "react-native";
import type { IngredientType } from "../../mealTypes";

type IngredientDetailPanelProps = {
  item: Pick<IngredientType, "calories" | "protein" | "fats" | "carbs" | "bridgeLabel" | "calculationError" | "source">;
};

// Simplified vs. the web version — we don't have per-ingredient macro_source/
// macro_basis_grams data here, so this just shows the total for the current
// (scaled) quantity, no per-100g comparison column.
export function IngredientDetailPanel({ item }: IngredientDetailPanelProps) {
  if (item.calories == null && !item.calculationError) return null;

  return (
    <View className="mb-1 mt-2 rounded-lg border border-ink-emphasis/10 px-3 py-2">
      {item.calories != null ? (
        <>
          <Text className="mb-1 font-inter-regular text-body text-ink-subtle">Total for this quantity</Text>
          <Text className="font-inter-medium text-caption text-ink">{item.calories} kcal</Text>
          <Text className="mt-0.5 font-inter-regular text-caption text-ink-subtle">
            <Text className="font-inter-medium text-ink">{item.protein ?? 0}g</Text> P{"  "}
            <Text className="font-inter-medium text-ink">{item.fats ?? 0}g</Text> F{"  "}
            <Text className="font-inter-medium text-ink">{item.carbs ?? 0}g</Text> C
          </Text>
        </>
      ) : (
        item.calculationError && (
          <Text className="font-inter-medium text-caption text-like">Can't calculate: {item.calculationError}</Text>
        )
      )}
      {item.bridgeLabel !== undefined && (
        <Text className="mt-1 font-inter-regular text-sub text-ink-subtle">
          {item.bridgeLabel ?? "no piece/ml bridge set"}
        </Text>
      )}
      {item.source && (
        <Text className="mt-0.5 font-inter-regular text-sub text-ink-subtle">Source: {item.source}</Text>
      )}
    </View>
  );
}
