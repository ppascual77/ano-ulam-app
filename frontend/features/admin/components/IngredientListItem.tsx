import { Pressable, Text, View } from "react-native";
import { Pencil, Archive } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { IngredientRow } from "@/api/ingredients";

type Props = {
  ingredient: IngredientRow;
  onEdit: () => void;
  onArchive: () => void;
};

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "primary" }) {
  return (
    <View
      className={`rounded-full px-2 py-0.5 ${tone === "primary" ? "bg-primary/10" : "bg-ink-emphasis/5"}`}
    >
      <AppText variant="caption" className={tone === "primary" ? "text-primary" : "text-ink-subtle"}>
        {label}
      </AppText>
    </View>
  );
}

export function IngredientListItem({ ingredient, onEdit, onArchive }: Props) {
  const macroSummary = [
    ingredient.calories != null ? `${ingredient.calories} cal` : null,
    ingredient.protein != null ? `${ingredient.protein}g P` : null,
    ingredient.carbohydrates != null ? `${ingredient.carbohydrates}g C` : null,
    ingredient.fat != null ? `${ingredient.fat}g F` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-center gap-3 border-b border-ink-emphasis/10 px-5 py-4">
      <View className="flex-1 gap-1">
        <Text className="font-inter-semibold text-body-lg text-ink-emphasis">{ingredient.canonical_name}</Text>
        {ingredient.display_name && ingredient.display_name !== ingredient.canonical_name && (
          <AppText variant="caption" className="text-ink-subtle">
            {ingredient.display_name}
          </AppText>
        )}
        <View className="flex-row flex-wrap items-center gap-1.5 mt-1">
          {ingredient.category && <Badge label={ingredient.category} />}
          {ingredient.role && <Badge label={ingredient.role === "main" ? "Main" : "Staple"} tone="primary" />}
          {ingredient.estimated_price != null && (
            <Badge
              label={`₱${ingredient.estimated_price}/${ingredient.estimated_price_unit ?? "?"} · ${ingredient.price_source}`}
            />
          )}
        </View>
        {macroSummary && (
          <AppText variant="caption" className="text-ink-subtle mt-0.5">
            {macroSummary} (per {ingredient.basis_amount}
            {ingredient.basis_unit}) · {ingredient.source ?? "unresolved"}
          </AppText>
        )}
      </View>

      <Pressable
        onPress={onEdit}
        accessibilityLabel={`Edit ${ingredient.canonical_name}`}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-emphasis/10 active:bg-ink-emphasis/5"
      >
        <Pencil color={colors.ink.emphasis} size={17} />
      </Pressable>
      <Pressable
        onPress={onArchive}
        accessibilityLabel={`Archive ${ingredient.canonical_name}`}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-emphasis/10 active:bg-ink-emphasis/5"
      >
        <Archive color={colors.ink.emphasis} size={17} />
      </Pressable>
    </View>
  );
}
