import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { GroceryItem } from "../utils/buildGroceryList";

// A grocery list splits into what to buy (main ingredients) and pantry
// staples (oil, salt and the like, usually already on hand).
export function splitGroceryItems(items: GroceryItem[]) {
  return {
    mains: items.filter((item) => item.category === "main"),
    staples: items.filter((item) => item.category === "pantry"),
  };
}

type GrocerySectionHeaderProps = {
  title: string;
  count: number;
  /** Shown on the right, e.g. the staples' "Include in total" toggle. */
  right?: ReactNode;
  className?: string;
};

// "TO BUY · 8" over a section of grocery rows.
export function GrocerySectionHeader({ title, count, right, className = "" }: GrocerySectionHeaderProps) {
  return (
    <View className={`flex-row items-center justify-between gap-3 px-2 ${className}`}>
      <Text className="font-inter-bold text-small uppercase text-ink-subtle">
        {title} · {count}
      </Text>
      {right}
    </View>
  );
}
