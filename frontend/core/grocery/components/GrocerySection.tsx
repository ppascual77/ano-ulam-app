import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { AppText } from "@/frontend/components/ui";
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

// "To buy." (in the dotted section-title style, a notch under the list's
// own title) and its item count, over a section of grocery rows.
export function GrocerySectionHeader({ title, count, right, className = "" }: GrocerySectionHeaderProps) {
  return (
    <View className={`flex-row items-center justify-between gap-3 px-2 ${className}`}>
      <View className="flex-row items-baseline gap-1.5">
        <AppText variant="sectionSubtitle" dot>
          {title}
        </AppText>
        <Text className="font-inter-semibold text-body text-ink-subtle">{count}</Text>
      </View>
      {right}
    </View>
  );
}
