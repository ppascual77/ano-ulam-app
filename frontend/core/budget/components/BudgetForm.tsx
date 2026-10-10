import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { PhilippinePeso, Utensils } from "lucide-react-native";
import { AppText, Button, Stepper, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type BudgetFormProps = {
  onSuggestMeals?: (params: { budget: string; servings: number }) => void;
};

// Forced "thinking" time before suggestions show, so the button's wave
// loading state actually gets seen (the suggestion itself is instant).
const SUGGEST_DELAY_MS = 2000;

export function BudgetForm({ onSuggestMeals }: BudgetFormProps) {
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState(1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const handleSuggest = () => {
    setIsSuggesting(true);
    timeout.current = setTimeout(() => {
      setIsSuggesting(false);
      onSuggestMeals?.({ budget, servings });
    }, SUGGEST_DELAY_MS);
  };

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <TextField
            label="Magkano budget?"
            icon={<PhilippinePeso color={colors.ink.normal} size={20} strokeWidth={2} />}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            strong
          />
        </View>

        <View
          className="flex-row items-center gap-2 rounded-2xl border border-ink-emphasis/10 px-4"
          style={{ height: 55 }}
        >
          <AppText variant="bodyMedium">Serving</AppText>
          <Stepper
            value={servings}
            onChange={setServings}
            min={1}
            decrementLabel="Fewer servings"
            incrementLabel="More servings"
          />
        </View>
      </View>

      <Button
        label="Suggest Meals"
        icon={<Utensils color={colors.white} size={20} strokeWidth={2} />}
        iconPosition="right"
        loading={isSuggesting}
        onPress={handleSuggest}
      />
    </View>
  );
}