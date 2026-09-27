import { Linking, Pressable, Text, View } from "react-native";
import { ExternalLink, Info } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { getUsdaSourceUrl } from "@/api/ingredients";
import type { IngredientType } from "../../mealTypes";

type IngredientDetailPanelProps = {
  item: Pick<
    IngredientType,
    "calories" | "protein" | "fats" | "carbs" | "bridgeLabel" | "calculationError" | "source" | "sourceRefId" | "sourceDescription" | "note"
  >;
};

// Simplified vs. the web version — we don't have per-ingredient macro_source/
// macro_basis_grams data here, so this just shows the total for the current
// (scaled) quantity, no per-100g comparison column.
export function IngredientDetailPanel({ item }: IngredientDetailPanelProps) {
  if (item.calories == null && !item.calculationError && !item.note) return null;

  const isUsda = item.source === "USDA";

  return (
    <View className="mb-1 mt-2 rounded-lg border border-ink-emphasis/10 px-3 py-2">
      {item.calories != null ? (
        <>
          <Text className="mb-1.5 font-inter-regular text-body text-ink-subtle">Total for this quantity</Text>
          <View className="flex-row items-center justify-between">
            <Text className="font-inter-semibold text-caption text-ink">{Math.round(item.calories)} kcal</Text>
            <Text className="font-inter-medium text-caption text-ink">
              {(item.protein ?? 0).toFixed(1)}g <Text className="font-inter-regular text-ink-subtle">P</Text>
            </Text>
            <Text className="font-inter-medium text-caption text-ink">
              {(item.fats ?? 0).toFixed(1)}g <Text className="font-inter-regular text-ink-subtle">F</Text>
            </Text>
            <Text className="font-inter-medium text-caption text-ink">
              {(item.carbs ?? 0).toFixed(1)}g <Text className="font-inter-regular text-ink-subtle">C</Text>
            </Text>
          </View>
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

      {/* USDA-sourced ingredients only — a "manual"/"FNRI"/unset source has
          no FoodData Central record to attribute, so nothing renders here
          for those. */}
      {isUsda && (
        <View className="mt-2 gap-1.5 border-t border-ink-emphasis/10 pt-2">
          <View className="flex-row items-center gap-1.5">
            <View className="rounded px-1.5 py-0.5 bg-usda">
              <Text className="font-inter-bold text-sub text-white">USDA</Text>
            </View>
            <Text className="font-inter-semibold text-caption text-ink">USDA FoodData Central</Text>
            <Info color={colors.ink.subtle} size={12} />
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-inter-regular text-sub text-ink-subtle" numberOfLines={1}>
              {item.sourceDescription ?? "—"}
              {item.sourceRefId ? ` (FDC ID: ${item.sourceRefId})` : ""}
            </Text>
            {item.sourceRefId && (
              <Pressable
                onPress={() => Linking.openURL(getUsdaSourceUrl(item.sourceRefId as string))}
                className="flex-row items-center gap-1"
              >
                <Text className="font-inter-medium text-sub text-primary">View source</Text>
                <ExternalLink color={colors.primary} size={11} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
