import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState, Screen, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useMeals } from "../hooks/useMeals";
import { AdminMealCard } from "../components/AdminMealCard";

export default function ManageMealsScreen() {
  const { data: meals, isLoading, isError } = useMeals({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meals ?? [];
    return (meals ?? []).filter((m) => m.name.toLowerCase().includes(q));
  }, [meals, search]);

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">Manage Meals</AppText>
          <AppText variant="caption" className="text-ink-subtle">
            {meals?.length ?? 0} meals
          </AppText>
        </View>
      </View>

      <View className="px-5 gap-3 mb-4">
        <Button label="+ Seed Meal" onPress={() => router.push("/seed-meal")} />
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search meals..." />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {filtered.map((meal) => (
              <AdminMealCard key={meal.id} meal={meal} onPress={() => router.push(`/view-meal/${meal.id}`)} />
            ))}
          </View>
          {filtered.length === 0 && (
            <AppText variant="body" className="text-ink-subtle text-center mt-8">
              {search ? "No meals match your search." : "No meals yet — seed one to get started."}
            </AppText>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
