import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Plus, Utensils } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { usePantry, usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import { PANTRY_MIN_FOR_SUGGESTIONS } from "@/frontend/core/pantry/mock/api";
import { PANTRY_SUBTITLE, PantrySheet } from "@/frontend/core/pantry/components/PantrySheet";

function addLabel(count: number) {
  if (count === 0) return "Add ingredients from your kitchen";
  if (count < PANTRY_MIN_FOR_SUGGESTIONS) {
    return `${count} added, add ${PANTRY_MIN_FOR_SUGGESTIONS - count} more to suggest`;
  }
  return `${count} ingredient${count === 1 ? "" : "s"} added`;
}

// What's in the user's kitchen. Saved when "Find Meals" is tapped and when
// the tab goes away (switching tabs or leaving Profile).
export function PantryTab() {
  const { data: pantry = [] } = usePantry();
  const actions = usePantryActions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const canSuggest = pantry.length >= PANTRY_MIN_FOR_SUGGESTIONS;

  useEffect(() => {
    return () => void actions.persist();
    // Save once, on unmount.
  }, []);

  const findMeals = async () => {
    await actions.persist();
    router.push({
      pathname: "/pantry-results",
      // JSON: ingredient names can contain commas ("Chicken, thigh").
      params: { ids: JSON.stringify(pantry.map((p) => p.id)), names: JSON.stringify(pantry.map((p) => p.name)) },
    });
  };

  return (
    <View className="gap-4 pb-6">
      <View>
        <Text className="font-inter-semibold text-body text-web-ink">Your Pantry</Text>
        <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{PANTRY_SUBTITLE}</Text>
      </View>

      <Pressable
        onPress={findMeals}
        disabled={!canSuggest}
        className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-green ${canSuggest ? "" : "opacity-30"}`}
      >
        <Text className="font-inter-semibold text-body text-white">Find Meals I Can Cook</Text>
        <Utensils color={colors.white} size={15} />
      </Pressable>

      <Pressable
        onPress={() => setSheetOpen(true)}
        className="flex-row items-center gap-2 rounded-xl border border-dashed border-web-ink-faint px-4 py-3.5 active:border-brand-green"
      >
        <Plus color={colors.webInk.body} size={15} />
        <Text className="font-inter-regular text-body text-web-ink-body">{addLabel(pantry.length)}</Text>
      </Pressable>

      {pantry.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {pantry.map((item) => (
            <View key={item.id} className="flex-row items-center gap-1.5 rounded-full border border-brand-green px-2.5 py-1">
              <Text className="font-inter-regular text-small text-brand-green">{item.name}</Text>
              <Pressable onPress={() => actions.remove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.name}`}>
                <Text className="font-inter-regular text-small text-brand-green/60">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <PantrySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
