import { View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { PulsePressable } from "./PulsePressable";
import { RollingText } from "./RollingText";

// "md": inline (Home's Serving box). "lg": a standalone control (the Meal
// Planner's "How many people?").
const SIZES = {
  md: { button: 30, icon: 14, gap: "gap-2", minWidth: 20 },
  lg: { button: 40, icon: 16, gap: "gap-5", minWidth: 28 },
} as const;

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: keyof typeof SIZES;
  /** Screen reader labels for the buttons. */
  decrementLabel?: string;
  incrementLabel?: string;
};

function StepButton({
  onPress,
  disabled,
  size,
  label,
  children,
}: {
  onPress: () => void;
  disabled: boolean;
  size: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <PulsePressable
      onPress={onPress}
      disabled={disabled}
      pulse="subtle"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-full border border-ink-emphasis/15 bg-white ${
        disabled ? "opacity-30" : "active:bg-ink-emphasis/5"
      }`}
    >
      {children}
    </PulsePressable>
  );
}

// Round − / + buttons around a bold number that rolls up on +, down on −.
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  size = "md",
  decrementLabel = "Decrease",
  incrementLabel = "Increase",
}: StepperProps) {
  const s = SIZES[size];
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  return (
    <View className={`flex-row items-center ${s.gap}`}>
      <StepButton onPress={() => onChange(value - 1)} disabled={!canDecrement} size={s.button} label={decrementLabel}>
        <Minus color={colors.ink.emphasis} size={s.icon} strokeWidth={2.5} />
      </StepButton>
      <View style={{ minWidth: s.minWidth }} className="items-center">
        <RollingText value={value} rank={value} className="text-center font-inter-extrabold text-subheading text-ink-emphasis" />
      </View>
      <StepButton onPress={() => onChange(value + 1)} disabled={!canIncrement} size={s.button} label={incrementLabel}>
        <Plus color={colors.ink.emphasis} size={s.icon} strokeWidth={2.5} />
      </StepButton>
    </View>
  );
}
