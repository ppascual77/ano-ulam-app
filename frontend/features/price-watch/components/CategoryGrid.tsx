import { Pressable, View } from "react-native";
import { AppText } from "@/frontend/components/ui";
import type { PriceCategory } from "@/frontend/core/prices/utils/prices";
import { CategoryTile } from "./CategoryTile";
import { priceWatchCategories } from "../constants/categories";

const COLUMNS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

type CategoryGridProps = {
  /** null = All. */
  selected: PriceCategory | null;
  onSelect: (category: PriceCategory | null) => void;
};

// Tapping the selected tile again (or "See all") goes back to All.
export function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  const rows = chunk(priceWatchCategories, COLUMNS);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="title">Check by Category</AppText>
        {selected && (
          <Pressable onPress={() => onSelect(null)} hitSlop={8}>
            <AppText variant="bodyMedium" className="text-primary">
              See all
            </AppText>
          </Pressable>
        )}
      </View>

      <View className="gap-3">
        {rows.map((row, i) => (
          <View key={i} className="flex-row justify-between">
            {row.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                selected={category.id === selected}
                onPress={() => onSelect(category.id === selected ? null : category.id)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
