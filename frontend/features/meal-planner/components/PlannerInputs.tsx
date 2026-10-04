import { Pressable, Text, TextInput, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { Stepper, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { MacroTargets } from "../utils/macros";

export const MAX_SERVINGS = 10;

// Digits only, shown with thousands separators ("1500" -> "1,500").
export const parseBudget = (text: string) => Number(text.replace(/[^0-9]/g, "")) || 0;
const formatBudget = (text: string) => {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 7);
  return digits ? Number(digits).toLocaleString("en-PH") : "";
};

function SectionLabel({ children }: { children: string }) {
  return <Text className="mb-2 font-inter-semibold text-body text-web-ink-soft">{children}</Text>;
}

// The primary field: a large ₱ amount on a soft fill, no hard border.
export function BudgetInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <View>
      <SectionLabel>Weekly budget</SectionLabel>
      <View className="flex-row items-center gap-2 rounded-2xl bg-web-divider/70 px-5 py-4">
        <Text className="font-inter-bold text-heading text-primary">₱</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(formatBudget(text))}
          placeholder="e.g. 1,500"
          placeholderTextColor={colors.ink.placeholder}
          keyboardType="number-pad"
          returnKeyType="done"
          className="flex-1 font-inter-bold text-heading text-web-ink"
          style={{ padding: 0 }}
        />
      </View>
    </View>
  );
}

export function ServingStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-inter-semibold text-body text-web-ink-soft">For how many people?</Text>
      <Stepper value={value} onChange={onChange} min={1} max={MAX_SERVINGS} />
    </View>
  );
}

type MacroGoalRowProps = {
  targets: MacroTargets | null;
  /** Toggle on (opens the sheet) / off (clears the goal). */
  onToggle: (on: boolean) => void;
  /** Tap the enabled card to edit. */
  onEdit: () => void;
};

// Off: a toggle row. On: a compact card with the targets, tap to edit.
export function MacroGoalRow({ targets, onToggle, onEdit }: MacroGoalRowProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-web-ink-soft">Set a macro goal</Text>
          <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">Plan around calories and macros</Text>
        </View>
        <Toggle checked={!!targets} onChange={onToggle} />
      </View>

      {targets && (
        <Pressable
          onPress={onEdit}
          className="flex-row items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 px-4 py-3 active:bg-brand-green/10"
        >
          <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-green">
            <Check color={colors.white} size={14} strokeWidth={3} />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-body text-web-ink">Macro goal enabled</Text>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-body">
              {targets.calories.toLocaleString("en-PH")} kcal · {targets.protein}g protein
            </Text>
          </View>
          <ChevronRight color={colors.webInk.muted} size={16} />
        </Pressable>
      )}
    </View>
  );
}
