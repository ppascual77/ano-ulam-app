import { View, ScrollView } from "react-native";
import { AppText, BottomSheet, Button, LoadingState } from "@/frontend/components/ui";
import type { PendingIngredientChange } from "../hooks/useConfirmedIngredientUpdate";

type Props = {
  pending: PendingIngredientChange[] | null;
  affectedMeals: { id: string; name: string }[];
  loading: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Shown before ANY write to the shared ingredients table actually happens —
// see useConfirmedIngredientUpdate for why. Purely a preview; nothing is
// written until "Confirm Update" is tapped here.
export function ConfirmIngredientUpdateSheet({ pending, affectedMeals, loading, isSaving, onConfirm, onCancel }: Props) {
  const visible = !!pending;
  const names = pending?.map((p) => p.name) ?? [];

  return (
    <BottomSheet visible={visible} onClose={onCancel} heightPercent={0.6}>
      <View className="flex-1 px-8 pt-10">
<AppText variant="sectionTitle" dot className="mb-1">
          {names.length <= 1 ? `Update ${names[0] ?? "ingredient"}?` : `Update ${names.length} ingredients?`}
        </AppText>
        <AppText variant="caption" className="text-ink-subtle mb-4">
          {names.length <= 1 ? "This ingredient is" : "These ingredients are"} used in shared recipes — saving
          recomputes the stored totals for every meal that uses {names.length <= 1 ? "it" : "them"}.
        </AppText>

        {loading ? (
          <LoadingState />
        ) : affectedMeals.length === 0 ? (
          <AppText variant="body" className="text-ink-subtle">
            Not currently used in any meal — nothing else will be affected.
          </AppText>
        ) : (
          <>
            <AppText variant="bodyBold" className="mb-2">
              {affectedMeals.length} meal{affectedMeals.length === 1 ? "" : "s"} will be recomputed:
            </AppText>
            <ScrollView className="mb-4" style={{ maxHeight: 220 }}>
              {affectedMeals.map((m) => (
                <AppText key={m.id} variant="caption" className="py-1 text-ink-subtle">
                  • {m.name}
                </AppText>
              ))}
            </ScrollView>
          </>
        )}

        <View className="flex-1" />

        <View className="gap-2 pb-8">
          <Button label={isSaving ? "Updating..." : "Confirm Update"} disabled={isSaving || loading} onPress={onConfirm} />
          <Button label="Cancel" variant="outline" disabled={isSaving} onPress={onCancel} />
        </View>
      </View>
    </BottomSheet>
  );
}
