import { useEffect, useState } from "react";
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
  /** Fires once this sheet's close animation has actually finished — see
   *  BottomSheet's onClosed. */
  onClosed?: () => void;
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
export function ConfirmIngredientSheet({ visible, patch, onCancel, onConfirm, isSaving, error, onClosed }: Props) {
  // `visible` and `patch` null out in the same commit (the caller derives
  // visible from `!!patch`) — retaining the last non-null patch lets
  // BottomSheet keep rendering (and animating closed) instead of this
  // component unmounting it abruptly, which would skip the close
  // animation and never fire onClosed.
  const [lastPatch, setLastPatch] = useState(patch);
  useEffect(() => {
    if (patch) setLastPatch(patch);
  }, [patch]);
  const displayPatch = patch ?? lastPatch;

  if (!displayPatch) return null;

  return (
    <BottomSheet visible={visible} onClose={onCancel} onClosed={onClosed} heightPercent={0.75}>
      <View className="flex-1 px-8 pt-16">
<AppText variant="sectionTitle" dot className="mb-1">
          Review before adding
        </AppText>
        <AppText variant="caption" className="text-ink-subtle mb-4">
          This creates a new ingredient in the shared database and links it to this meal.
        </AppText>

        <View>
          <Row label="Name" value={displayPatch.canonical_name} />
          {displayPatch.display_name && <Row label="Specification" value={displayPatch.display_name} />}
          {displayPatch.aliases && displayPatch.aliases.length > 0 && (
            <Row label="Aliases" value={displayPatch.aliases.join(", ")} />
          )}
          <Row label="Category" value={[displayPatch.category, displayPatch.food_group].filter(Boolean).join(" · ") || "—"} />
          <Row label="Role / State" value={[displayPatch.role, displayPatch.state].filter(Boolean).join(" · ") || "—"} />
          <Row
            label="Per"
            value={`${displayPatch.basis_amount ?? "?"} ${displayPatch.basis_unit ?? "?"}`}
          />
          <Row
            label="Calories"
            value={displayPatch.calories != null ? `${displayPatch.calories} kcal` : "—"}
          />
          <Row
            label="Protein / Carbs / Fat"
            value={`${displayPatch.protein ?? "?"}g / ${displayPatch.carbohydrates ?? "?"}g / ${displayPatch.fat ?? "?"}g`}
          />
          <Row
            label="Sugar / Fiber / Sodium"
            value={`${displayPatch.sugar ?? "?"}g / ${displayPatch.fiber ?? "?"}g / ${displayPatch.sodium ?? "?"}mg`}
          />
          <Row
            label="Price"
            value={displayPatch.estimated_price != null ? `₱${displayPatch.estimated_price} / ${displayPatch.estimated_price_unit ?? "?"}` : "—"}
          />
          {(displayPatch.grams_per_piece || displayPatch.piece_label) && (
            <Row
              label="Piece"
              value={`${displayPatch.grams_per_piece ?? "?"}g per ${displayPatch.piece_label ?? "piece"}`}
            />
          )}
          <Row label="Source" value={displayPatch.source_description ?? "AI-estimated, pending review"} />
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
