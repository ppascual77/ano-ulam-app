import { useEffect, useState } from "react";
import { View } from "react-native";
import { TextField } from "@/frontend/components/ui";
import type { NutritionGoals } from "@/api/auth";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { ProSettingSheet } from "./ProSettingSheet";

type Draft = Record<keyof NutritionGoals, string>;

const FIELDS: { key: keyof NutritionGoals; label: string; suffix: string }[] = [
  { key: "calories", label: "Calories", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbs", label: "Carbs (optional)", suffix: "g" },
  { key: "fat", label: "Fat (optional)", suffix: "g" },
];

const toDraft = (goals: NutritionGoals): Draft => ({
  calories: goals.calories?.toString() ?? "",
  protein: goals.protein?.toString() ?? "",
  carbs: goals.carbs?.toString() ?? "",
  fat: goals.fat?.toString() ?? "",
});

// Blank or not a positive number: not set.
const toGoal = (text: string) => {
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

// Pro: daily calorie and macro targets. A form, saved on Save (not acted on
// anywhere yet).
export function NutritionGoalsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();
  const [draft, setDraft] = useState<Draft>(() => toDraft(prefs.nutrition_goals));
  // Fresh from what's saved every time it opens (drops unsaved edits).
  useEffect(() => {
    if (visible) setDraft(toDraft(prefs.nutrition_goals));
  }, [visible]);

  const save = () => {
    setPrefs({
      ...prefs,
      nutrition_goals: {
        calories: toGoal(draft.calories),
        protein: toGoal(draft.protein),
        carbs: toGoal(draft.carbs),
        fat: toGoal(draft.fat),
      },
    });
    onClose();
  };

  return (
    <ProSettingSheet
      visible={visible}
      title="Nutrition goals"
      subtitle="Your daily targets, for suggestions and your meal plan."
      actionLabel="Save"
      onAction={save}
      onClose={onClose}
    >
      <View className="gap-4">
        {FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            labelPosition="outside"
            value={draft[field.key]}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, [field.key]: text }))}
            keyboardType="number-pad"
            suffix={field.suffix}
          />
        ))}
      </View>
    </ProSettingSheet>
  );
}
