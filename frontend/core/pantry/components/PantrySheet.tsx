import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { IngredientSearch } from "@/frontend/core/meals/components/IngredientSearch";
import { usePantry, usePantryActions } from "../hooks/usePantry";

export const PANTRY_SUBTITLE = "Add what you have, we'll find what you can cook.";

// Search the ingredient catalog and add/remove pantry items. Edits apply
// to the shared pantry list right away (see usePantryActions).
export function PantrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const addedIds = useMemo(() => new Set(pantry.map((item) => item.id)), [pantry]);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.7}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 pb-8 pt-10">
        <View>
          <Text className="font-inter-bold text-subheading text-web-ink">Your Pantry</Text>
          <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{PANTRY_SUBTITLE}</Text>
        </View>

        <IngredientSearch
          placeholder="Search ingredient…"
          disabledIds={addedIds}
          onPick={(ingredient) => actions.add({ id: ingredient.id, name: ingredient.canonical_name })}
        />

        {pantry.length > 0 ? (
          <View className="gap-2">
            <Text className="font-inter-regular text-small text-web-ink-muted">
              {pantry.length} ingredient{pantry.length === 1 ? "" : "s"} added
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {pantry.map((item) => (
                <View key={item.id} className="flex-row items-center gap-1.5 rounded-full border border-brand-green px-3 py-1.5">
                  <Text className="font-inter-light text-small text-brand-green">{item.name}</Text>
                  <Pressable onPress={() => actions.remove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.name}`}>
                    <X color={colors.brandGreen.DEFAULT} size={11} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text className="py-4 text-center font-inter-regular text-body text-web-ink-faint">No ingredients added yet</Text>
        )}

        <Pressable
          onPress={onClose}
          disabled={pantry.length === 0}
          className={`mt-2 items-center rounded-2xl bg-brand-green py-3 ${pantry.length === 0 ? "opacity-40" : ""}`}
        >
          <Text className="font-inter-semibold text-body text-white">Done, I've added my pantry</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
