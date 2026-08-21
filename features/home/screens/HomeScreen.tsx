import { View } from "react-native";
import { Screen } from "@/components/ui";
import { Header } from "@/features/home/components/Header";
import { MealSuggestionForm } from "@/features/home/components/MealSuggestionForm";
import { CategoriesSection } from "@/features/home/components/CategoriesSection";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function HomeScreen() {
  return (
    <Screen>
      <View className="flex-1">
        {/* TODO: "Patrick" is a placeholder — replace with the authenticated
            user's first name once auth/profile data is wired up. */}
        <Header name="Patrick" />
        <View className="mt-6">
          <MealSuggestionForm />
        </View>
        <View className="mt-6">
          <CategoriesSection />
        </View>
      </View>
      <BottomNav />
    </Screen>
  );
}
