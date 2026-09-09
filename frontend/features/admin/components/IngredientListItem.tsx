import { Pressable, View } from "react-native";
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
        <AppText variant="bodyBold">{ingredient.canonical_name}</AppText>
        {ingredient.display_name && ingredient.display_name !== ingredient.canonical_name && (
          <AppText variant="caption" className="text-ink-subtle">
            {ingredient.display_name}
          </AppText>
        )}
        <View className="flex-row flex-wrap items-center gap-1.5 mt-1">
          {ingredient.category && <Badge label={ingredient.category} />}
          {ingredient.role && <Badge label={ingredient.role} tone="primary" />}
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

      <Pressable onPress={onEdit} className="h-9 w-9 items-center justify-center">
        <Pencil color={colors.ink.subtle} size={18} />
      </Pressable>
      <Pressable onPress={onArchive} className="h-9 w-9 items-center justify-center">
        <Archive color={colors.ink.subtle} size={18} />
      </Pressable>
    </View>
  );
}
