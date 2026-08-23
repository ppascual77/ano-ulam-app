import { Pressable, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

function StepButton({ onPress, disabled, children }: { onPress: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ width: 30, height: 30, borderRadius: 5 }}
      className={`items-center justify-center border border-ink-emphasis/10 ${disabled ? "opacity-30" : "active:bg-ink-emphasis/5"}`}
    >
      {children}
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 1, max }: StepperProps) {
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  return (
    <View className="flex-row items-center gap-1.5">
      <StepButton onPress={() => onChange(value - 1)} disabled={!canDecrement}>
        <Minus color={colors.ink.normal} size={14} strokeWidth={2} />
      </StepButton>
      <AppText variant="bodyBold" className="text-center" style={{ minWidth: 16 }}>
        {value}
      </AppText>
      <StepButton onPress={() => onChange(value + 1)} disabled={!canIncrement}>
        <Plus color={colors.ink.normal} size={14} strokeWidth={2} />
      </StepButton>
    </View>
  );
}
