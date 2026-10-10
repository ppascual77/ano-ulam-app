import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Hamburger, Moon, Sun } from "lucide-react-native";
import { AppText, LandingTitle, type LandingDot } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
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
  },
  {
    id: "lunch",
    label: "Lunch",
    image: require("@/assets/icons/lunch-category-logo.png"),
    badgeIcon: Sun,
    badgeColor: colors.primary,
    bgClassName: "bg-category-lunch",
    borderClassName: "border-category-lunch-border",
  },
  {
    id: "dinner",
    label: "Dinner",
    image: require("@/assets/icons/dinner-category-logo.png"),
    badgeIcon: Moon,
    badgeColor: colors.category.dinnerIcon,
    bgClassName: "bg-category-dinner",
    borderClassName: "border-category-dinner-border",
  },
  {
    id: "fastfood",
    label: "Fastfood",
    image: require("@/assets/icons/fastfood-category-logo.png"),
    badgeIcon: Hamburger,
    badgeColor: colors.category.fastfoodIcon,
    bgClassName: "bg-category-fastfood",
    borderClassName: "border-category-fastfood-border",
  },
];

type CategoriesSectionProps = {
  /** The title's period: Home's post-onboarding intro lands its dot here. */
  landing?: LandingDot;
};

export function CategoriesSection({ landing }: CategoriesSectionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <LandingTitle {...landing}>Categories</LandingTitle>
        {/* Only while a category is picked: clears the pick. */}
        {selected && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
            <Pressable onPress={() => setSelected(null)} hitSlop={8} accessibilityLabel="Clear category">
              <AppText variant="bodyMedium" className="text-primary">
                Clear
              </AppText>
            </Pressable>
          </Animated.View>
        )}
      </View>
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
