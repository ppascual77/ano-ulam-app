import { View } from "react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import type { IngredientRow } from "@/api/ingredients";

type Props = {
  visible: boolean;
  patch: (Partial<IngredientRow> & { canonical_name: string }) | null;
  onCancel: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  error?: string | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4 py-2 border-b border-ink-emphasis/5">
      <AppText variant="caption" className="text-ink-subtle">
        {label}
      </AppText>
      <AppText variant="body" className="flex-1 text-right">
        {value}
      </AppText>
    </View>
  );
}

// Final read-only checkpoint before an AI-estimated ingredient actually
// gets written to the shared ingredients table and linked to this meal —
// nothing persists until the admin explicitly confirms here, same
// "grounding never silently applies" principle as USDA matching.
export function ConfirmIngredientSheet({ visible, patch, onCancel, onConfirm, isSaving, error }: Props) {
  if (!patch) return null;

  return (
    <BottomSheet visible={visible} onClose={onCancel} heightPercent={0.75}>
      <View className="flex-1 px-8 pt-16">
        <AppText variant="heading" className="mb-1">
          Review before adding
        </AppText>
        <AppText variant="caption" className="text-ink-subtle mb-4">
          This creates a new ingredient in the shared database and links it to this meal.
        </AppText>

        <View>
          <Row label="Name" value={patch.canonical_name} />
          {patch.display_name && <Row label="Specification" value={patch.display_name} />}
          {patch.aliases && patch.aliases.length > 0 && <Row label="Aliases" value={patch.aliases.join(", ")} />}
          <Row label="Category" value={[patch.category, patch.food_group].filter(Boolean).join(" · ") || "—"} />
          <Row label="Role / State" value={[patch.role, patch.state].filter(Boolean).join(" · ") || "—"} />
          <Row
            label="Per"
            value={`${patch.basis_amount ?? "?"} ${patch.basis_unit ?? "?"}`}
          />
          <Row
            label="Calories"
            value={patch.calories != null ? `${patch.calories} kcal` : "—"}
          />
          <Row
            label="Protein / Carbs / Fat"
            value={`${patch.protein ?? "?"}g / ${patch.carbohydrates ?? "?"}g / ${patch.fat ?? "?"}g`}
          />
          <Row
            label="Sugar / Fiber / Sodium"
            value={`${patch.sugar ?? "?"}g / ${patch.fiber ?? "?"}g / ${patch.sodium ?? "?"}mg`}
          />
          <Row
            label="Price"
            value={patch.estimated_price != null ? `₱${patch.estimated_price} / ${patch.estimated_price_unit ?? "?"}` : "—"}
          />
          {(patch.grams_per_piece || patch.piece_label) && (
            <Row
              label="Piece"
              value={`${patch.grams_per_piece ?? "?"}g per ${patch.piece_label ?? "piece"}`}
            />
          )}
          <Row label="Source" value={patch.source_description ?? "AI-estimated, pending review"} />
        </View>

        <View className="flex-1" />

        {error && (
          <AppText variant="caption" className="text-like mb-2">
            Couldn't add ingredient: {error}
          </AppText>
        )}

        <View className="gap-2 pb-8">
          <Button
            label={isSaving ? "Adding..." : "Confirm & add to meal"}
            disabled={isSaving}
            onPress={onConfirm}
          />
          <Button label="Back to edit" variant="outline" disabled={isSaving} onPress={onCancel} />
        </View>
      </View>
    </BottomSheet>
  );
}
