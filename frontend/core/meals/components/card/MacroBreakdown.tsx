import { Text, View } from "react-native";
import type { MacroType } from "@/frontend/core/meals/mealTypes";

type MacroStatProps = {
  value: string | number;
  label: string;
  valueClassName: string;
  labelClassName: string;
};

function MacroStat({ value, label, valueClassName, labelClassName }: MacroStatProps) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className={valueClassName}>{value}</Text>
      <Text className={labelClassName}>{label}</Text>
    </View>
  );
}

type MacroBreakdownProps = {
  macros: MacroType;
  isSectioned?: boolean;
  variant?: "light" | "dark";
  /** Set false when calories are shown elsewhere (e.g. MealCard's grid variant overlays it on the image). */
  showCalories?: boolean;
};

export function MacroBreakdown({ macros, isSectioned = true, variant = "light", showCalories = true }: MacroBreakdownProps) {
  const isDark = variant === "dark";

  // Dark is for text over a photo (Discover's reel): smaller, tracked-out
  // white values over 60%-white labels.
  const valueClassName = isDark
    ? "font-inter-semibold text-small tracking-wide text-white"
    : "font-inter-regular text-body text-ink";
  const labelClassName = isDark
    ? "font-inter-regular text-sub tracking-wide text-white/60"
    : "font-inter-regular text-body text-ink-subtle";
  const proteinClassName = isDark ? valueClassName : "font-inter-regular text-body text-macro-protein";
  const carbsClassName = isDark ? valueClassName : "font-inter-regular text-body text-macro-carbs";
  const fatsClassName = isDark ? valueClassName : "font-inter-regular text-body text-macro-fats";

  return (
    <View
      className={`flex-row justify-between rounded-md p-1 ${!isDark ? "mt-3" : ""} ${
        isSectioned && !isDark ? "border border-ink-emphasis/10" : ""
      }`}
    >
      {showCalories && <MacroStat value={macros.calories} label="kcal" valueClassName={valueClassName} labelClassName={labelClassName} />}
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.protein}g`} label="Protein" valueClassName={proteinClassName} labelClassName={labelClassName} />
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.carbs}g`} label="Carbs" valueClassName={carbsClassName} labelClassName={labelClassName} />
      {isDark && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.fats}g`} label="Fats" valueClassName={fatsClassName} labelClassName={labelClassName} />
    </View>
  );
}
