import { useEffect, useRef, useState } from "react";
import { PhilippinePeso, Utensils } from "lucide-react-native";
import { Keyboard, View } from "react-native";
import { AppText, Button, Stepper, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { parseBudget } from "../utils/budgetMatch";

type SuggestParams = { budget: string; servings: number };

type BudgetFormProps = {
  onSuggestMeals?: (params: SuggestParams) => void;
  /** Checked before suggesting (e.g. the daily limit): false skips the
   *  "thinking" and the suggestion, and the caller shows why. */
  beforeSuggest?: (params: SuggestParams) => Promise<boolean>;
};

// Forced "thinking" time before suggestions show, so the button's wave
// loading state actually gets seen (the suggestion itself is instant).
const SUGGEST_DELAY_MS = 2000;

export function BudgetForm({ onSuggestMeals, beforeSuggest }: BudgetFormProps) {
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState(1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const reduceMotion = useReduceMotion();
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const handleSuggest = async () => {
    // The budget's keyboard goes away as soon as it's pressed.
    Keyboard.dismiss();
    if (isSuggesting) return;
    if (beforeSuggest && !(await beforeSuggest({ budget, servings }))) return;
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
        // Reduce motion: the twirling spiral, no wave snap or confetti.
        loader={reduceMotion ? "spiral" : "wave"}
        onPress={handleSuggest}
        // Nothing to suggest for until there's an amount (and an empty
        // budget mustn't use up a daily suggestion).
        disabled={parseBudget(budget) == null}
      />
    </View>
  );
}