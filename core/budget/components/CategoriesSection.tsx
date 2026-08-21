import { useState } from "react";
import { View } from "react-native";
import { Hamburger, Moon, Sun } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { CategoryCard } from "./CategoryCard";

const CATEGORIES = [
  {
    id: "breakfast",
    label: "Breakfast",
    image: require("@/assets/icons/breakfast-category-logo.png"),
    badgeIcon: Sun,
    badgeColor: colors.accent,
    bgClassName: "bg-category-breakfast",
    borderClassName: "border-category-breakfast-border",
    selectedBorderClassName: "border-category-breakfast-border-selected",
  },
  {
    id: "lunch",
    label: "Lunch",
    image: require("@/assets/icons/lunch-category-logo.png"),
    badgeIcon: Sun,
    badgeColor: colors.primary,
    bgClassName: "bg-category-lunch",
    borderClassName: "border-category-lunch-border",
    selectedBorderClassName: "border-category-lunch-border-selected",
  },
  {
    id: "dinner",
    label: "Dinner",
    image: require("@/assets/icons/dinner-category-logo.png"),
    badgeIcon: Moon,
    badgeColor: colors.category.dinnerIcon,
    bgClassName: "bg-category-dinner",
    borderClassName: "border-category-dinner-border",
    selectedBorderClassName: "border-category-dinner-border-selected",
  },
  {
    id: "fastfood",
    label: "Fastfood",
    image: require("@/assets/icons/fastfood-category-logo.png"),
    badgeIcon: Hamburger,
    badgeColor: colors.category.fastfoodIcon,
    bgClassName: "bg-category-fastfood",
    borderClassName: "border-category-fastfood-border",
    selectedBorderClassName: "border-category-fastfood-border-selected",
  },
];

export function CategoriesSection() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View className="gap-3">
      <AppText variant="title">Categories</AppText>
      <View className="flex-row gap-3">
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category.id}
            {...category}
            selected={selected === category.id}
            onPress={() => setSelected(selected === category.id ? null : category.id)}
          />
        ))}
      </View>
    </View>
  );
}
