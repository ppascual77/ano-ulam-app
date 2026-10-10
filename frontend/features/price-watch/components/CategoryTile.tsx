import { Pressable } from "react-native";
import { Image } from "expo-image";
import { AppText } from "@/frontend/components/ui";
import type { PriceWatchCategory } from "../constants/categories";

type CategoryTileProps = {
  category: PriceWatchCategory;
  selected: boolean;
  onPress: () => void;
};

export function CategoryTile({ category, selected, onPress }: CategoryTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.label} category`}
      style={{ width: "23%" }}
      className={`items-center gap-1 rounded-2xl border py-3 ${
        selected ? "border-primary bg-primary/5" : "border-ink-emphasis/10 bg-white"
      }`}
    >
      <Image source={category.icon} style={{ width: 40, height: 40 }} contentFit="contain" />
      <AppText variant="caption" className={selected ? "text-primary" : "text-ink-emphasis"}>
        {category.label}
      </AppText>
    </Pressable>
  );
}
