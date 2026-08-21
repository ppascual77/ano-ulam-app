import { ReactNode } from "react";
import { Text, View } from "react-native";

type ChipsProps = {
  label: string;
  icon?: ReactNode;
  /** Defaults to bg-primary. Pass e.g. "bg-accent" for a different fill. */
  bgClassName?: string;
};

// Only the "large" pill (icon + uppercase label, e.g. a meal card's time/
// restaurant/verified badges) is built out — that's the only variant any
// screen actually uses today. Add more variants here if a real need shows up.
export function Chips({ label, icon, bgClassName = "bg-primary" }: ChipsProps) {
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${bgClassName}`}>
      {icon}
      <Text className="font-inter-semibold text-sub uppercase tracking-wide text-white">{label}</Text>
    </View>
  );
}
