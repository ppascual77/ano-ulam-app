import { ActivityIndicator, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { OutsideLabel } from "./TextField";

type SelectFieldProps = {
  label: string;
  valueLabel: string;
  loading?: boolean;
  /** Same as TextField's: "outside" puts the label above a compact box, so
   *  a select can sit in a row of outside-label TextFields. */
  labelPosition?: "floating" | "outside";
};

// Trigger for a select-style Dropdown (pass it as `trigger`, with
// matchTriggerWidth). Mirrors TextField's floating-label layout (small
// label above the value, both inside the same bordered box) so a select
// reads as the same kind of field, not a different control: just
// statically in the "filled" state, since a select always has a value.
export function SelectField({ label, valueLabel, loading, labelPosition = "floating" }: SelectFieldProps) {
  const chevron = loading ? (
    <ActivityIndicator size="small" color={colors.primary} />
  ) : (
    <ChevronDown color={colors.ink.subtle} size={16} />
  );

  if (labelPosition === "outside") {
    return (
      <View>
        <OutsideLabel>{label}</OutsideLabel>
        <View
          className="flex-row items-center justify-between px-4"
          style={{ borderRadius: 12, borderWidth: 1, height: 55, borderColor: "rgba(43, 52, 55, 0.1)" }}
        >
          <Text numberOfLines={1} className="flex-1 font-inter-semibold text-subheading text-ink-emphasis">
            {valueLabel}
          </Text>
          {chevron}
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center justify-between px-4"
      style={{ borderRadius: 16, borderWidth: 1, height: 55, borderColor: "rgba(43, 52, 55, 0.1)" }}
    >
      <View className="flex-1 justify-center" style={{ height: 44 }}>
        <Text className="font-inter-medium text-body text-ink-subtle">{label}</Text>
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-inter-semibold text-subheading text-ink-emphasis">
          {valueLabel}
        </Text>
      </View>
      {chevron}
    </View>
  );
}
