import { View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { PulsePressable } from "./PulsePressable";
import { RollingText } from "./RollingText";

const BUTTON_SIZE = 30;
const BUTTON_RADIUS = 5;

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

function StepButton({ onPress, disabled, children }: { onPress: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <PulsePressable
      onPress={onPress}
      disabled={disabled}
      radius={BUTTON_RADIUS}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_RADIUS }}
      className={`items-center justify-center border border-ink-emphasis/10 ${disabled ? "opacity-30" : "active:bg-ink-emphasis/5"}`}
    >
      {children}
    </PulsePressable>
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
      {/* Rolls up on +, down on −. Same look as AppText's bodyBold. */}
      <View style={{ minWidth: 16 }} className="items-center">
        <RollingText value={value} rank={value} className="text-center font-inter-bold text-body text-ink" />
      </View>
      <StepButton onPress={() => onChange(value + 1)} disabled={!canIncrement}>
        <Plus color={colors.ink.normal} size={14} strokeWidth={2} />
      </StepButton>
    </View>
  );
}
