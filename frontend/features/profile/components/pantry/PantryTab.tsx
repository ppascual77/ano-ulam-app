import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Plus, Utensils, X } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
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
    <View className="gap-5 pb-6">
      <View>
        <View className="flex-row items-baseline gap-1.5">
          <AppText variant="sectionSubtitle" dot>
            Your pantry
          </AppText>
          {pantry.length > 0 && <Text className="font-inter-semibold text-body text-ink-subtle">{pantry.length}</Text>}
        </View>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">{PANTRY_SUBTITLE}</Text>
      </View>

      <Pressable
        onPress={() => setSheetOpen(true)}
        className="flex-row items-center gap-3 rounded-2xl border border-dashed border-ink-emphasis/25 px-4 py-3.5 active:border-primary active:bg-primary/5"
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Plus color={colors.primary} size={18} strokeWidth={2.5} />
        </View>
        <Text className="flex-1 font-inter-medium text-body-lg text-ink">{addLabel(pantry.length)}</Text>
      </Pressable>

      {pantry.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {pantry.map((item) => (
            <View key={item.id} className="flex-row items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pl-3.5 pr-2">
              <Text className="font-inter-semibold text-body text-primary">{item.name}</Text>
              <Pressable
                onPress={() => actions.remove(item.id)}
                hitSlop={8}
                accessibilityLabel={`Remove ${item.name}`}
                className="h-5 w-5 items-center justify-center rounded-full active:bg-primary/15"
              >
                <X color={colors.primary} size={14} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View className="gap-2">
        <Button
          label="Find meals I can cook"
          icon={<Utensils color={colors.white} size={18} />}
          iconPosition="right"
          onPress={findMeals}
          disabled={!canSuggest}
        />
        {!canSuggest && (
          <Text className="text-center font-inter-regular text-small text-ink-subtle">
            Add at least {PANTRY_MIN_FOR_SUGGESTIONS} ingredients to find meals.
          </Text>
        )}
      </View>

      <PantrySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
