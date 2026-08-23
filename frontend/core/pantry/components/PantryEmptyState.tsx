import { View } from "react-native";
import { Image } from "expo-image";
import { AppText, Button } from "@/frontend/components/ui";

type PantryEmptyStateProps = {
  onAddIngredients?: () => void;
};

export function PantryEmptyState({ onAddIngredients }: PantryEmptyStateProps) {
  return (
    <View className="items-center py-4">
      <Image
        source={require("@/assets/empty-pantry.gif")}
        style={{ width: 250, height: 250, marginTop: 20 }}
        contentFit="contain"
      />

      <AppText variant="heading" className="mt-2 text-center">
        Your pantry is empty
      </AppText>
      <AppText variant="body" className="mt-1 text-center px-5">
        Add ingredients you already have and we&apos;ll suggest meals you can cook!
      </AppText>

      <Image
        source={require("@/assets/empty-pantry-arrow.png")}
        style={{ width: 36, height: 80 }}
        contentFit="contain"
      />

      <View className="w-full">
        <Button label="Add ingredients" onPress={onAddIngredients} />
      </View>
    </View>
  );
}
