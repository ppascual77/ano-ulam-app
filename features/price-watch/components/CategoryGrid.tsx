import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { CategoryTile } from "./CategoryTile";
import { priceWatchCategories } from "../mocks/categories";

const COLUMNS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// Selecting a category is wired up (visual state only) — the ingredient
// price list for the selected category isn't built yet.
export function CategoryGrid() {
  const [selectedId, setSelectedId] = useState(priceWatchCategories[0].id);
  const rows = chunk(priceWatchCategories, COLUMNS);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="title">Check by Category</AppText>
        <Pressable>
          <AppText variant="bodyMedium" className="text-primary">
            See all
          </AppText>
        </Pressable>
      </View>

      <View className="gap-3">
        {rows.map((row, i) => (
          <View key={i} className="flex-row justify-between">
            {row.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                selected={category.id === selectedId}
                onPress={() => setSelectedId(category.id)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
