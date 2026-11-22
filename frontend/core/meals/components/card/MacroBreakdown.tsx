import { View, useWindowDimensions } from "react-native";
import { Text, textLevel } from "@/frontend/components/ui/Text";
import type { MacroType } from "@/frontend/core/meals/mealTypes";

type MacroStatProps = {
  value: string | number;
  label: string;
  valueClassName: string;
  labelClassName: string;
  /** Bigger/Largest text: two per row instead of all in one. */
  half?: boolean;
};

// Each value and label stays on one line, shrinking to fit rather than
// breaking mid-word ("Protei/n", "163.8/g": BUG-5).
function MacroStat({ value, label, valueClassName, labelClassName, half = false }: MacroStatProps) {
  return (
    <View className={`items-center justify-center px-0.5 ${half ? "basis-1/2 py-1" : "flex-1"}`}>
      <Text numberOfLines={1} adjustsFontSizeToFit className={valueClassName}>
        {value}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className={labelClassName}>
        {label}
      </Text>
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
  // From the Bigger text level up, four numbers don't fit one card row:
  // a 2x2 grid instead (no dividers there).
  const grid = textLevel(useWindowDimensions().fontScale) > 0;
  const divider = isDark && !grid;

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
      className={`flex-row justify-between rounded-md p-1 ${grid ? "flex-wrap" : ""} ${!isDark ? "mt-3" : ""} ${
        isSectioned && !isDark ? "border border-ink-emphasis/10" : ""
      }`}
    >
      {showCalories && (
        <MacroStat value={macros.calories} label="kcal" valueClassName={valueClassName} labelClassName={labelClassName} half={grid} />
      )}
      {divider && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.protein}g`} label="Protein" valueClassName={proteinClassName} labelClassName={labelClassName} half={grid} />
      {divider && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.carbs}g`} label="Carbs" valueClassName={carbsClassName} labelClassName={labelClassName} half={grid} />
      {divider && <View className="w-px self-stretch bg-white/20" />}
      <MacroStat value={`${macros.fats}g`} label="Fats" valueClassName={fatsClassName} labelClassName={labelClassName} half={grid} />
    </View>
  );
}
