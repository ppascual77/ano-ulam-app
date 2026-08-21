import { Text, View } from "react-native";
import type { MacroType } from "@/core/meals/mealTypes";

type MacroStatProps = {
  value: string | number;
  label: string;
  valueClassName: string;
};

function MacroStat({ value, label, valueClassName }: MacroStatProps) {
  return (
    <View className="w-12 items-center justify-center">
      <Text className={`font-inter-regular text-body ${valueClassName}`}>{value}</Text>
      <Text className="font-inter-regular text-body text-ink-subtle">{label}</Text>
    </View>
  );
}

type MacroBreakdownProps = {
  macros: MacroType;
  isSectioned?: boolean;
  variant?: "light" | "dark";
};

export function MacroBreakdown({ macros, isSectioned = true, variant = "light" }: MacroBreakdownProps) {
  const isDark = variant === "dark";

  const valueClassName = isDark ? "text-white font-inter-semibold" : "text-ink font-inter-regular";
  const proteinClassName = isDark ? valueClassName : "text-macro-protein font-inter-regular";
  const carbsClassName = isDark ? valueClassName : "text-macro-carbs font-inter-regular";
  const fatsClassName = isDark ? valueClassName : "text-macro-fats font-inter-regular";

  return (
    <View
      className={`flex-row justify-between rounded-md p-1 ${!isDark ? "mt-3" : ""} ${
        isSectioned && !isDark ? "border border-ink-emphasis/10" : ""
      }`}
    >
      <MacroStat value={macros.calories} label="kcal" valueClassName={valueClassName} />
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.protein}g`} label="Protein" valueClassName={proteinClassName} />
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.carbs}g`} label="Carbs" valueClassName={carbsClassName} />
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.fats}g`} label="Fats" valueClassName={fatsClassName} />
    </View>
  );
}
