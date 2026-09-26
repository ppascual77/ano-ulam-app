import { Text, View } from "react-native";
import type { IngredientType } from "../../mealTypes";

type IngredientDetailPanelProps = {
  item: Pick<IngredientType, "calories" | "protein" | "fats" | "carbs" | "bridgeLabel" | "calculationError" | "source" | "note">;
};

// Simplified vs. the web version — we don't have per-ingredient macro_source/
// macro_basis_grams data here, so this just shows the total for the current
// (scaled) quantity, no per-100g comparison column.
export function IngredientDetailPanel({ item }: IngredientDetailPanelProps) {
  if (item.calories == null && !item.calculationError && !item.note) return null;

  return (
    <View className="mb-1 mt-2 rounded-lg border border-ink-emphasis/10 px-3 py-2">
      {item.calories != null ? (
        <>
          <Text className="mb-1 font-inter-regular text-body text-ink-subtle">Total for this quantity</Text>
          <Text className="font-inter-medium text-caption text-ink">{Math.round(item.calories)} kcal</Text>
          <Text className="mt-0.5 font-inter-regular text-caption text-ink-subtle">
            <Text className="font-inter-medium text-ink">{(item.protein ?? 0).toFixed(1)}g</Text> P{"  "}
            <Text className="font-inter-medium text-ink">{(item.fats ?? 0).toFixed(1)}g</Text> F{"  "}
            <Text className="font-inter-medium text-ink">{(item.carbs ?? 0).toFixed(1)}g</Text> C
          </Text>
        </>
      ) : (
        item.calculationError && (
          <Text className="font-inter-medium text-caption text-like">Can't calculate: {item.calculationError}</Text>
        )
      )}
      {/* For every viewer, not an admin-only diagnostic — explains why the
          counted amount differs from the quantity shown above it (e.g.
          "1 cup" used for frying, but only a fraction gets absorbed).
          Without this, a real gap between the two reads as a bug. */}
      {item.note && (
        <Text className="mt-1 font-inter-medium text-caption text-ink-subtle">{item.note}</Text>
      )}
      {/* Only shown when a bridge is actually set — a working conversion
          that didn't need one (e.g. a weight unit like "14 oz") has
          nothing worth reporting here, and showing "no bridge set" next
          to a perfectly correct total reads as a false alarm. The real
          "no bridge" case is already explained by calculationError above. */}
      {item.bridgeLabel && (
        <Text className="mt-1 font-inter-regular text-sub text-ink-subtle">{item.bridgeLabel}</Text>
      )}
      {item.source && (
        <Text className="mt-0.5 font-inter-regular text-sub text-ink-subtle">Source: {item.source}</Text>
      )}
    </View>
  );
}
