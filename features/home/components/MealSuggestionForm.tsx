import { useState } from "react";
import { View } from "react-native";
import { PhilippinePeso, Utensils } from "lucide-react-native";
import { AppText, Button, ChipSelect, Stepper, TextField } from "@/components/ui";
import { colors } from "@/constants/theme";

const MODE_OPTIONS = [
  { id: "budget", label: "By Budget" },
  { id: "pantry", label: "By Pantry" },
];

export function MealSuggestionForm() {
  const [mode, setMode] = useState<string[]>(["budget"]);
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState(1);

  return (
    <View className="gap-4">
      <ChipSelect
        variant="segmented"
        mode="single"
        required
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />

      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <TextField
            label="Magkano budget?"
            icon={<PhilippinePeso color={colors.ink.normal} size={20} strokeWidth={2} />}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
          />
        </View>

        <View
          className="flex-row items-center gap-2 rounded-2xl border border-ink-emphasis/10 px-4"
          style={{ height: 55 }}
        >
          <AppText variant="bodyMedium">Serving</AppText>
          <Stepper value={servings} onChange={setServings} min={1} />
        </View>
      </View>

      <Button
        label="Suggest Meals"
        icon={<Utensils color={colors.white} size={20} strokeWidth={2} />}
        iconPosition="right"
      />
    </View>
  );
}
