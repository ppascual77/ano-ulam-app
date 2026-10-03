import { ReactNode } from "react";
import { Text, View } from "react-native";

// "solid" is the large pill (icon + uppercase label on a filled background,
// e.g. a meal card's time/restaurant/verified badges). "soft" is a tinted
// pill with normal-case, larger text, for values meant to be read rather
// than glanced at (e.g. a ₱/kg price in an ingredient's price sources).
const variantClasses = {
  solid: { bg: "bg-primary", text: "font-inter-semibold text-sub uppercase tracking-wide text-white" },
  soft: { bg: "bg-primary/10", text: "font-inter-semibold text-small text-primary" },
} as const;

type ChipsProps = {
  label: string;
  icon?: ReactNode;
  variant?: keyof typeof variantClasses;
  /** Overrides the variant's fill, e.g. "bg-accent". */
  bgClassName?: string;
};

export function Chips({ label, icon, variant = "solid", bgClassName }: ChipsProps) {
  const classes = variantClasses[variant];
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${bgClassName ?? classes.bg}`}>
      {icon}
      <Text className={classes.text}>{label}</Text>
    </View>
  );
}
